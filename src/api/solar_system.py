"""Public API for 3D solar system visualization."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.models import AstronomicalEvent
from src.core.services.positions import get_body_positions_async

router = APIRouter(prefix="/api")


@router.get("/solar-system")
async def get_solar_system(
    time: str | None = Query(None, description="ISO datetime, defaults to now"),
    session: AsyncSession = Depends(get_db),
):
    """Get real positions of Sun, Earth, Moon + upcoming events."""
    if time:
        dt = datetime.fromisoformat(time.replace("Z", "+00:00"))
    else:
        dt = datetime.now(timezone.utc)

    # Get body positions from Skyfield
    bodies = await get_body_positions_async(dt)

    # Get events in ±30 days window
    window_start = dt - timedelta(days=7)
    window_end = dt + timedelta(days=30)

    stmt = select(AstronomicalEvent).where(
        AstronomicalEvent.global_start_time_utc.between(window_start, window_end)
    ).order_by(AstronomicalEvent.global_start_time_utc)

    result = await session.execute(stmt)
    events_db = result.scalars().all()

    events = []
    for ev in events_db:
        events.append({
            "id": ev.id,
            "type": ev.type,
            "class_type": ev.class_type.value,
            "time_utc": ev.global_start_time_utc.isoformat(),
            "parameters": ev.parameters,
        })

    return {
        "time_utc": dt.isoformat(),
        "bodies": bodies,
        "events": events,
    }


@router.get("/events/calendar")
async def get_events_calendar(
    year: int = Query(..., description="Year to fetch events for"),
    session: AsyncSession = Depends(get_db),
):
    """Get all events for a given year, grouped by month."""
    stmt = (
        select(AstronomicalEvent)
        .where(extract("year", AstronomicalEvent.global_start_time_utc) == year)
        .order_by(AstronomicalEvent.global_start_time_utc)
    )

    result = await session.execute(stmt)
    events_db = result.scalars().all()

    months = {m: [] for m in range(1, 13)}
    for ev in events_db:
        m = ev.global_start_time_utc.month
        months[m].append({
            "id": ev.id,
            "type": ev.type,
            "class_type": ev.class_type.value,
            "time_utc": ev.global_start_time_utc.isoformat(),
            "parameters": ev.parameters,
        })

    return {
        "year": year,
        "months": [{"month": m, "events": months[m]} for m in range(1, 13)],
    }
