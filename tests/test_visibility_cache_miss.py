from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from src.core.models import AstronomicalEvent, EventClass, EventVisibilityCache, Location
from src.core.services.visibility import build_visibility_cache_for_location


@pytest.mark.asyncio
async def test_build_visibility_cache_for_location_creates_entries(db_session, monkeypatch):
    location = Location(
        latitude=53.2001,
        longitude=50.15,
        timezone="Europe/Samara",
        lat_rounded=53.2,
        lon_rounded=50.15,
    )
    db_session.add(location)
    await db_session.flush()

    event = AstronomicalEvent(
        type="meteor_peak",
        class_type=EventClass.REGULAR,
        global_start_time_utc=datetime.now(timezone.utc) + timedelta(days=2),
        parameters={"shower_name": "Testids"},
        seed_version="test",
    )
    db_session.add(event)
    await db_session.commit()

    async def fake_compute_visibility_async(**kwargs):
        return True, event.global_start_time_utc

    monkeypatch.setattr(
        "src.core.services.visibility.compute_visibility_async",
        fake_compute_visibility_async,
    )

    computed_count = await build_visibility_cache_for_location(
        db_session,
        location.id,
        days_ahead=7,
    )

    result = await db_session.execute(select(EventVisibilityCache))
    cache = result.scalar_one()
    assert computed_count == 1
    assert cache.location_id == location.id
    assert cache.event_id == event.id
    assert cache.is_visible is True
