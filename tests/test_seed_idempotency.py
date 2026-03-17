"""Test that seeding is idempotent — running it twice doesn't create duplicates."""
import pytest
from sqlalchemy import func, select

from src.core.models import AstronomicalEvent
from src.data.seed_db import seed_events


@pytest.mark.asyncio
async def test_seed_creates_events(db_session):
    await seed_events(db_session)
    result = await db_session.execute(select(func.count(AstronomicalEvent.id)))
    count = result.scalar()
    assert count == 14, f"Expected 14 events, got {count}"


@pytest.mark.asyncio
async def test_seed_idempotent(db_session):
    # Seed twice
    await seed_events(db_session)
    await seed_events(db_session)

    result = await db_session.execute(select(func.count(AstronomicalEvent.id)))
    count = result.scalar()
    assert count == 14, f"Expected 14 events after double seed, got {count}"


@pytest.mark.asyncio
async def test_seed_updates_on_version_change(db_session):
    await seed_events(db_session)

    # Manually change version of an event to simulate old data
    result = await db_session.execute(
        select(AstronomicalEvent).where(AstronomicalEvent.type == "solar_eclipse")
    )
    event = result.scalar_one()
    event.seed_version = "v0"
    await db_session.flush()

    # Re-seed should update the event
    await seed_events(db_session)

    result = await db_session.execute(
        select(AstronomicalEvent).where(AstronomicalEvent.type == "solar_eclipse")
    )
    updated = result.scalar_one()
    assert updated.seed_version == "v2"
