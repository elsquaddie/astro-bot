"""Tests for notification state machine."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from src.core.models import (
    AstronomicalEvent,
    EventClass,
    EventVisibilityCache,
    Location,
    Notification,
    NotificationStatus,
    User,
)
from src.core.services.notifications import (
    mark_failed,
    mark_sending,
    mark_sent,
    plan_notifications,
)


async def _create_test_data(session):
    """Create test user, location, event, and visibility cache."""
    location = Location(
        latitude=55.75, longitude=37.61, timezone="Europe/Moscow",
        lat_rounded=55.75, lon_rounded=37.61,
    )
    session.add(location)
    await session.flush()

    user = User(telegram_id=111111, location_id=location.id, notify_rare=True, notify_regular=True)
    session.add(user)
    await session.flush()

    event = AstronomicalEvent(
        type="lunar_eclipse",
        class_type=EventClass.RARE,
        global_start_time_utc=datetime.now(timezone.utc) + timedelta(days=3),
        parameters={"eclipse_type": "total"},
        seed_version="v1",
    )
    session.add(event)
    await session.flush()

    vis = EventVisibilityCache(
        location_id=location.id,
        event_id=event.id,
        is_visible=True,
        local_best_time=event.global_start_time_utc,
    )
    session.add(vis)
    await session.flush()

    return user, event


@pytest.mark.asyncio
async def test_plan_creates_notifications(db_session):
    user, event = await _create_test_data(db_session)
    count = await plan_notifications(db_session)
    assert count == 1

    result = await db_session.execute(select(Notification))
    notification = result.scalar_one()
    assert notification.status == NotificationStatus.PENDING
    assert notification.user_id == user.id
    assert notification.event_id == event.id


@pytest.mark.asyncio
async def test_plan_idempotent(db_session):
    await _create_test_data(db_session)
    count1 = await plan_notifications(db_session)
    count2 = await plan_notifications(db_session)
    assert count1 == 1
    assert count2 == 0  # No new notifications


@pytest.mark.asyncio
async def test_state_machine_happy_path(db_session):
    await _create_test_data(db_session)
    await plan_notifications(db_session)

    result = await db_session.execute(select(Notification))
    notification = result.scalar_one()

    await mark_sending(db_session, notification.id)
    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.SENDING

    await mark_sent(db_session, notification.id)
    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.SENT


@pytest.mark.asyncio
async def test_state_machine_retry_then_fail(db_session):
    await _create_test_data(db_session)
    await plan_notifications(db_session)

    result = await db_session.execute(select(Notification))
    notification = result.scalar_one()

    # Retry 1
    await mark_sending(db_session, notification.id)
    await mark_failed(db_session, notification.id, "timeout")
    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.PENDING
    assert notification.retry_count == 1

    # Retry 2
    await mark_sending(db_session, notification.id)
    await mark_failed(db_session, notification.id, "timeout")
    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.PENDING
    assert notification.retry_count == 2

    # Retry 3 -> permanent failure
    await mark_sending(db_session, notification.id)
    await mark_failed(db_session, notification.id, "timeout")
    await db_session.refresh(notification)
    assert notification.status == NotificationStatus.FAILED
    assert notification.retry_count == 3
