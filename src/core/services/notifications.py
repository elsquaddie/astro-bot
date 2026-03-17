"""Notification Planner + Sender with state machine."""
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import (
    AstronomicalEvent,
    EventClass,
    EventVisibilityCache,
    Notification,
    NotificationStatus,
    User,
    UserNotificationPreference,
)

logger = structlog.get_logger()

DEFAULT_AHEAD_HOURS = {
    EventClass.RARE: 24,
    EventClass.REGULAR: 24,
}


async def plan_notifications(session: AsyncSession) -> int:
    """
    Create pending notifications based on visibility cache + user preferences.
    Returns count of newly created notifications.
    """
    now = datetime.now(timezone.utc)
    created = 0

    # Get users with locations
    stmt = select(User).where(User.location_id.is_not(None))
    result = await session.execute(stmt)
    users = list(result.scalars().all())

    for user in users:
        # Determine which event classes user wants
        classes = []
        if user.notify_rare:
            classes.append(EventClass.RARE)
        if user.notify_regular:
            classes.append(EventClass.REGULAR)

        if not classes:
            continue

        # Get user's preferences for ahead_hours
        pref_stmt = select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == user.id
        )
        pref_result = await session.execute(pref_stmt)
        prefs = {p.event_class: p.ahead_hours for p in pref_result.scalars().all()}

        # Find visible events for this user's location
        vis_stmt = (
            select(EventVisibilityCache)
            .join(AstronomicalEvent)
            .where(
                EventVisibilityCache.location_id == user.location_id,
                EventVisibilityCache.is_visible.is_(True),
                AstronomicalEvent.class_type.in_(classes),
                AstronomicalEvent.global_start_time_utc > now,
            )
        )
        vis_result = await session.execute(vis_stmt)
        visible_entries = list(vis_result.scalars().all())

        for vis in visible_entries:
            ahead_hours = prefs.get(
                # need event class_type
                EventClass.RARE,  # default
                DEFAULT_AHEAD_HOURS[EventClass.RARE],
            )

            # Load event to get class_type for ahead_hours
            event_stmt = select(AstronomicalEvent).where(
                AstronomicalEvent.id == vis.event_id
            )
            event_result = await session.execute(event_stmt)
            event = event_result.scalar_one()

            ahead_hours = prefs.get(
                event.class_type,
                DEFAULT_AHEAD_HOURS.get(event.class_type, 24),
            )

            scheduled_time = event.global_start_time_utc - timedelta(hours=ahead_hours)
            if scheduled_time < now:
                scheduled_time = now

            # Check if notification already exists
            existing_stmt = select(Notification).where(
                Notification.user_id == user.id,
                Notification.event_id == vis.event_id,
            )
            existing_result = await session.execute(existing_stmt)
            if existing_result.scalar_one_or_none() is not None:
                continue

            notification = Notification(
                user_id=user.id,
                event_id=vis.event_id,
                scheduled_send_time_utc=scheduled_time,
                status=NotificationStatus.PENDING,
            )
            session.add(notification)
            created += 1

    await session.commit()
    logger.info("notification_planner.done", created=created)
    return created


async def get_pending_notifications(
    session: AsyncSession, limit: int = 100
) -> list[Notification]:
    """
    Get pending notifications ready to send.
    Uses FOR UPDATE SKIP LOCKED to prevent race conditions.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Notification)
        .where(
            Notification.status == NotificationStatus.PENDING,
            Notification.scheduled_send_time_utc <= now,
        )
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def mark_sending(session: AsyncSession, notification_id: int) -> None:
    """Transition: pending -> sending."""
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id)
        .values(status=NotificationStatus.SENDING)
    )
    await session.commit()


async def mark_sent(session: AsyncSession, notification_id: int) -> None:
    """Transition: sending -> sent."""
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id)
        .values(status=NotificationStatus.SENT)
    )
    await session.commit()


async def mark_failed(
    session: AsyncSession, notification_id: int, error: str
) -> None:
    """Transition: sending -> failed or back to pending for retry."""
    stmt = select(Notification).where(Notification.id == notification_id)
    result = await session.execute(stmt)
    notification = result.scalar_one()

    notification.retry_count += 1
    notification.last_error = error

    if notification.retry_count >= 3:
        notification.status = NotificationStatus.FAILED
        logger.warning("notification.failed_permanently", id=notification_id, error=error)
    else:
        notification.status = NotificationStatus.PENDING
        logger.info("notification.retry", id=notification_id, retry=notification.retry_count)

    await session.commit()
