"""Visibility service: Two-Step (SQL bbox + Skyfield) + UPSERT."""
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import AstronomicalEvent, EventVisibilityCache, Location
from src.core.services.astronomy import compute_visibility_async

logger = structlog.get_logger()


async def get_candidate_events(
    session: AsyncSession, days_ahead: int = 7
) -> list[AstronomicalEvent]:
    """Get global events within the next N days."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days_ahead)
    stmt = select(AstronomicalEvent).where(
        AstronomicalEvent.global_start_time_utc.between(now, cutoff)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_locations_for_event(
    session: AsyncSession, event: AstronomicalEvent
) -> list[Location]:
    """Step 1: SQL bounding box filter for locations potentially seeing the event."""
    stmt = select(Location)

    # If event has a bounding box, filter locations by it
    if event.min_lat is not None:
        stmt = stmt.where(
            and_(
                Location.latitude >= event.min_lat,
                Location.latitude <= event.max_lat,
                Location.longitude >= event.min_lon,
                Location.longitude <= event.max_lon,
            )
        )

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def compute_and_cache_visibility(
    session: AsyncSession,
    event: AstronomicalEvent,
    location: Location,
) -> None:
    """Step 2: Skyfield calculation + UPSERT into cache."""
    try:
        is_visible, best_time = await compute_visibility_async(
            event_type=event.type,
            lat=location.latitude,
            lon=location.longitude,
            event_time_utc=event.global_start_time_utc,
            parameters=event.parameters,
        )

        stmt = pg_insert(EventVisibilityCache).values(
            location_id=location.id,
            event_id=event.id,
            is_visible=is_visible,
            local_best_time=best_time,
        ).on_conflict_do_update(
            constraint="uq_location_event",
            set_={
                "is_visible": is_visible,
                "local_best_time": best_time,
            },
        )
        await session.execute(stmt)
        await session.commit()

        logger.info(
            "visibility.computed",
            event_id=event.id,
            location_id=location.id,
            is_visible=is_visible,
        )
    except Exception:
        await session.rollback()
        logger.exception(
            "visibility.error",
            event_id=event.id,
            location_id=location.id,
        )


async def build_visibility_cache(session: AsyncSession) -> None:
    """Main job: compute visibility for all events x locations."""
    events = await get_candidate_events(session)
    logger.info("cache_builder.start", event_count=len(events))

    for event in events:
        locations = await get_locations_for_event(session, event)
        for location in locations:
            await compute_and_cache_visibility(session, event, location)

    logger.info("cache_builder.done")
