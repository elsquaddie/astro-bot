"""Tests for user and visibility services."""
import pytest
from sqlalchemy import func, select

from src.core.models import EventClass, Location, User
from src.core.services.users import (
    get_or_create_location,
    get_or_create_user,
    set_user_location,
    update_notification_preferences,
)


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = await get_or_create_user(db_session, telegram_id=12345)
    assert user.telegram_id == 12345
    assert user.id is not None


@pytest.mark.asyncio
async def test_get_existing_user(db_session):
    user1 = await get_or_create_user(db_session, telegram_id=12345)
    user2 = await get_or_create_user(db_session, telegram_id=12345)
    assert user1.id == user2.id


@pytest.mark.asyncio
async def test_create_location(db_session):
    loc = await get_or_create_location(db_session, 55.7558, 37.6173, "Europe/Moscow")
    assert loc.lat_rounded == 55.76
    assert loc.lon_rounded == 37.62


@pytest.mark.asyncio
async def test_location_deduplication(db_session):
    loc1 = await get_or_create_location(db_session, 55.7558, 37.6173, "Europe/Moscow")
    loc2 = await get_or_create_location(db_session, 55.7560, 37.6170, "Europe/Moscow")
    assert loc1.id == loc2.id


@pytest.mark.asyncio
async def test_set_user_location(db_session):
    user = await set_user_location(db_session, telegram_id=99999, latitude=55.75, longitude=37.61, tz="Europe/Moscow")
    assert user.location_id is not None


@pytest.mark.asyncio
async def test_set_user_location_with_city_metadata(db_session):
    user = await set_user_location(
        db_session,
        telegram_id=123456,
        latitude=53.2001,
        longitude=50.15,
        tz="Europe/Samara",
        display_name="Samara, Samara Oblast, Russia",
        country_code="RU",
        admin1="Samara Oblast",
        source_location_id=499099,
    )

    location = await db_session.get(Location, user.location_id)
    assert location.display_name == "Samara, Samara Oblast, Russia"
    assert location.country_code == "RU"
    assert location.admin1 == "Samara Oblast"
    assert location.source_location_id == 499099


@pytest.mark.asyncio
async def test_notification_preferences(db_session):
    user = await get_or_create_user(db_session, telegram_id=77777)
    pref = await update_notification_preferences(db_session, user.id, EventClass.RARE, ahead_hours=12)
    assert pref.ahead_hours == 12
    assert pref.event_class == EventClass.RARE
