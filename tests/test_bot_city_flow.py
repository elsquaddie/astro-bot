from datetime import datetime, timedelta, timezone

import pytest

from src.bot.handlers import (
    cmd_today,
    format_city_candidates,
    format_location_saved_message,
    format_no_events_message,
    format_visibility_pending_message,
)
from src.core.models import AstronomicalEvent, EventClass, EventVisibilityCache
from src.core.services.geocoding import GeocodingCandidate
from src.core.services.users import set_user_location


def test_format_city_candidates():
    candidates = [
        GeocodingCandidate(
            source_location_id=499099,
            name="Samara",
            display_name="Samara, Samara Oblast, Russia",
            latitude=53.2001,
            longitude=50.15,
            timezone="Europe/Samara",
            country_code="RU",
            country="Russia",
            admin1="Samara Oblast",
            population=1170000,
        )
    ]

    text = format_city_candidates(candidates)

    assert "Samara, Samara Oblast, Russia" in text
    assert "Выбери город" in text


def test_format_city_candidates_supports_english():
    candidates = [
        GeocodingCandidate(
            source_location_id=5128581,
            name="New York",
            display_name="New York, United States",
            latitude=40.7143,
            longitude=-74.006,
            timezone="America/New_York",
            country_code="US",
            country="United States",
            admin1="New York",
            population=8800000,
        )
    ]

    text = format_city_candidates(candidates, language_code="en")

    assert "Choose a city" in text
    assert "New York, United States" in text


def test_format_location_saved_message_supports_english():
    text = format_location_saved_message("New York, United States", language_code="en")

    assert "Location saved" in text
    assert "calculating" in text.lower()


def test_format_visibility_pending_message_supports_english():
    text = format_visibility_pending_message("New York, United States", language_code="en")

    assert "still calculating" in text.lower()
    assert "New York" in text


def test_format_no_events_message_supports_english():
    text = format_no_events_message("New York, United States", days=7, language_code="en")

    assert "next 7 days" in text
    assert "New York" in text


def test_format_location_saved_message():
    text = format_location_saved_message("Samara, Samara Oblast, Russia")

    assert "Samara, Samara Oblast, Russia" in text
    assert "считаю" in text.lower()


def test_format_visibility_pending_message():
    text = format_visibility_pending_message("Samara, Samara Oblast, Russia")

    assert "еще считаю" in text.lower()
    assert "Samara" in text


def test_format_no_events_message():
    text = format_no_events_message("Samara, Samara Oblast, Russia", days=7)

    assert "ближайшие 7 дней" in text
    assert "Samara" in text


@pytest.mark.asyncio
async def test_today_builds_missing_cache_before_answering(db_session, monkeypatch):
    class FakeFromUser:
        id = 123456

    class FakeMessage:
        from_user = FakeFromUser()

        def __init__(self):
            self.answers = []

        async def answer(self, text, **kwargs):
            self.answers.append(text)

    user = await set_user_location(
        db_session,
        telegram_id=FakeFromUser.id,
        latitude=53.2001,
        longitude=50.15,
        tz="Europe/Samara",
        display_name="Samara, Samara Oblast, Russia",
    )
    event = AstronomicalEvent(
        type="meteor_peak",
        class_type=EventClass.REGULAR,
        global_start_time_utc=datetime.now(timezone.utc) + timedelta(days=2),
        parameters={"shower_name": "Testids"},
        seed_version="test",
    )
    db_session.add(event)
    await db_session.commit()

    async def fake_build_visibility_cache_for_location(session, location_id, days_ahead=30):
        session.add(
            EventVisibilityCache(
                location_id=location_id,
                event_id=event.id,
                is_visible=True,
                local_best_time=event.global_start_time_utc,
            )
        )
        await session.commit()
        return 1

    monkeypatch.setattr(
        "src.bot.handlers.build_visibility_cache_for_location",
        fake_build_visibility_cache_for_location,
    )

    message = FakeMessage()
    await cmd_today(message, db_session)

    assert user.location_id is not None
    assert len(message.answers) == 1
    assert "Upcoming astronomical events" in message.answers[0]
    assert "Testids" in message.answers[0]
