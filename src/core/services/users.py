"""User and Location CRUD with location deduplication."""
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import Location, User, UserNotificationPreference, EventClass

logger = structlog.get_logger()


async def get_or_create_location(
    session: AsyncSession,
    latitude: float,
    longitude: float,
    tz: str,
) -> Location:
    """Find or create a location with deduplication by rounded coords."""
    lat_rounded = round(latitude, 2)
    lon_rounded = round(longitude, 2)

    stmt = select(Location).where(
        Location.lat_rounded == lat_rounded,
        Location.lon_rounded == lon_rounded,
    )
    result = await session.execute(stmt)
    location = result.scalar_one_or_none()

    if location is None:
        location = Location(
            latitude=latitude,
            longitude=longitude,
            timezone=tz,
            lat_rounded=lat_rounded,
            lon_rounded=lon_rounded,
        )
        session.add(location)
        await session.flush()
        logger.info("location.created", lat=lat_rounded, lon=lon_rounded)

    return location


async def get_or_create_user(
    session: AsyncSession, telegram_id: int
) -> User:
    """Find or create a user by telegram_id."""
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(telegram_id=telegram_id)
        session.add(user)
        await session.flush()
        logger.info("user.created", telegram_id=telegram_id)

    return user


async def set_user_location(
    session: AsyncSession,
    telegram_id: int,
    latitude: float,
    longitude: float,
    tz: str,
) -> User:
    """Set user's location (creates user and location if needed)."""
    user = await get_or_create_user(session, telegram_id)
    location = await get_or_create_location(session, latitude, longitude, tz)
    user.location_id = location.id
    await session.commit()
    return user


async def get_user_by_telegram_id(
    session: AsyncSession, telegram_id: int
) -> User | None:
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_notification_preferences(
    session: AsyncSession,
    user_id: int,
    event_class: EventClass,
    ahead_hours: int,
) -> UserNotificationPreference:
    """Upsert notification preference for a user."""
    stmt = select(UserNotificationPreference).where(
        UserNotificationPreference.user_id == user_id,
        UserNotificationPreference.event_class == event_class,
    )
    result = await session.execute(stmt)
    pref = result.scalar_one_or_none()

    if pref is None:
        pref = UserNotificationPreference(
            user_id=user_id,
            event_class=event_class,
            ahead_hours=ahead_hours,
        )
        session.add(pref)
    else:
        pref.ahead_hours = ahead_hours

    await session.commit()
    return pref
