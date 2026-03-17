"""API routes for events and users."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import verify_api_key
from src.core.database import get_db
from src.core.models import AstronomicalEvent, EventVisibilityCache, Location

router = APIRouter(prefix="/api", dependencies=[Depends(verify_api_key)])


class EventResponse(BaseModel):
    id: int
    type: str
    class_type: str
    start_time_utc: str
    is_visible: bool
    local_best_time: str | None
    parameters: dict | None

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    telegram_id: int
    latitude: float
    longitude: float
    timezone: str


class UserCreateResponse(BaseModel):
    id: int
    telegram_id: int
    location_id: int | None


@router.get("/events/today")
async def get_events_today(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    session: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    """Get today's astronomical events visible from given coordinates."""
    lat_rounded = round(lat, 2)
    lon_rounded = round(lon, 2)

    # Find nearest location
    location_stmt = select(Location).where(
        Location.lat_rounded == lat_rounded,
        Location.lon_rounded == lon_rounded,
    )
    result = await session.execute(location_stmt)
    location = result.scalar_one_or_none()

    if location is None:
        return []

    # Get today's visible events from cache
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    stmt = (
        select(EventVisibilityCache, AstronomicalEvent)
        .join(AstronomicalEvent)
        .where(
            EventVisibilityCache.location_id == location.id,
            EventVisibilityCache.is_visible.is_(True),
            AstronomicalEvent.global_start_time_utc.between(today_start, today_end),
        )
    )
    result = await session.execute(stmt)
    rows = result.all()

    events = []
    for vis, event in rows:
        events.append(EventResponse(
            id=event.id,
            type=event.type,
            class_type=event.class_type.value,
            start_time_utc=event.global_start_time_utc.isoformat(),
            is_visible=vis.is_visible,
            local_best_time=vis.local_best_time.isoformat() if vis.local_best_time else None,
            parameters=event.parameters,
        ))

    return events


@router.post("/users")
async def create_user(
    req: UserCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> UserCreateResponse:
    """Register a new user with location."""
    from src.core.services.users import set_user_location

    user = await set_user_location(
        session, req.telegram_id, req.latitude, req.longitude, req.timezone
    )
    return UserCreateResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        location_id=user.location_id,
    )
