"""Independent MVP verification checks.

This script complements pytest by checking expected user-facing behavior and
printing expected-vs-actual results. It exits non-zero when any check fails.
"""
from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

import httpx
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@dataclass(frozen=True)
class CheckResult:
    feature: str
    name: str
    expected: object
    actual: object
    passed: bool


def _load_app_with_flags(*, web_ui: bool, solar_api: bool):
    os.environ["BOT_TOKEN"] = "changeme"
    os.environ["ENABLE_WEB_UI"] = "true" if web_ui else "false"
    os.environ["ENABLE_SOLAR_SYSTEM_API"] = "true" if solar_api else "false"

    import src.config
    import src.main

    importlib.reload(src.config)
    return importlib.reload(src.main).app


async def verify_feature_flags() -> list[CheckResult]:
    app = _load_app_with_flags(web_ui=False, solar_api=False)
    transport = ASGITransport(app=app)
    checks: list[CheckResult] = []

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for name, path, expected_status in [
            ("health remains available", "/health", 200),
            ("prototype root UI is disabled", "/", 404),
            ("solar-system API is disabled", "/api/solar-system", 404),
        ]:
            response = await client.get(path)
            actual_status = response.status_code
            checks.append(
                CheckResult(
                    feature="feature_flags",
                    name=name,
                    expected={"status_code": expected_status},
                    actual={"status_code": actual_status},
                    passed=actual_status == expected_status,
                )
            )

    return checks


async def verify_geocoding() -> list[CheckResult]:
    from src.core.services.geocoding import OpenMeteoGeocoder

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/v1/search"):
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": 499099,
                            "name": "Samara",
                            "latitude": 53.2001,
                            "longitude": 50.15,
                            "timezone": "Europe/Samara",
                            "country_code": "RU",
                            "country": "Russia",
                            "admin1": "Samara Oblast",
                            "population": 1170000,
                        }
                    ]
                },
            )
        return httpx.Response(404, json={"error": True})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        geocoder = OpenMeteoGeocoder(
            client=client,
            base_url="https://geocoding-api.open-meteo.com",
        )
        results = await geocoder.search("Самара", language="ru")

    expected = {
        "count": 1,
        "display_name": "Samara, Samara Oblast, Russia",
        "timezone": "Europe/Samara",
    }
    actual = {
        "count": len(results),
        "display_name": results[0].display_name if results else None,
        "timezone": results[0].timezone if results else None,
    }
    return [
        CheckResult(
            feature="geocoding",
            name="Open-Meteo city response is parsed into a candidate",
            expected=expected,
            actual=actual,
            passed=actual == expected,
        )
    ]


async def verify_location_metadata() -> list[CheckResult]:
    from src.core.models import Location

    expected_columns = [
        "display_name",
        "country_code",
        "admin1",
        "source_location_id",
    ]
    actual_columns = [
        column for column in expected_columns if column in Location.__table__.columns
    ]
    return [
        CheckResult(
            feature="location_metadata",
            name="Location model exposes city metadata columns",
            expected={"columns": expected_columns},
            actual={"columns": actual_columns},
            passed=actual_columns == expected_columns,
        )
    ]


async def verify_visibility_cache() -> list[CheckResult]:
    from src.core.models import (
        AstronomicalEvent,
        Base,
        EventClass,
        EventVisibilityCache,
        Location,
    )
    import src.core.services.visibility as visibility_service

    database_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://astro:astro_pass@localhost:5432/astro_bot_test",
    )
    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    original_compute = visibility_service.compute_visibility_async

    async def fake_compute_visibility_async(**kwargs):
        return True, kwargs["event_time_utc"]

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        async with session_factory() as session:
            location = Location(
                latitude=53.2001,
                longitude=50.15,
                timezone="Europe/Samara",
                lat_rounded=53.2,
                lon_rounded=50.15,
            )
            session.add(location)
            await session.flush()

            event = AstronomicalEvent(
                type="meteor_peak",
                class_type=EventClass.REGULAR,
                global_start_time_utc=datetime.now(timezone.utc) + timedelta(days=2),
                parameters={"shower_name": "Verifierids"},
                seed_version="verify",
            )
            session.add(event)
            await session.commit()

            visibility_service.compute_visibility_async = fake_compute_visibility_async
            computed_count = await visibility_service.build_visibility_cache_for_location(
                session,
                location.id,
                days_ahead=7,
            )

            result = await session.execute(select(func.count(EventVisibilityCache.id)))
            cache_count = result.scalar_one()

        expected = {"computed_count": 1, "cache_count": 1}
        actual = {"computed_count": computed_count, "cache_count": cache_count}
        return [
            CheckResult(
                feature="visibility_cache",
                name="On-demand location cache creates one visibility row",
                expected=expected,
                actual=actual,
                passed=actual == expected,
            )
        ]
    finally:
        visibility_service.compute_visibility_async = original_compute
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


async def verify_weather() -> list[CheckResult]:
    from src.core.services.observation_conditions import (
        ObservationCondition,
        score_observation_conditions,
    )
    from src.core.services.weather import OpenMeteoWeatherClient

    score = score_observation_conditions(
        cloud_cover=20,
        precipitation_probability=5,
        visibility_m=20000,
        event_time_utc=datetime(2026, 5, 26, 18, 0, tzinfo=timezone.utc),
        forecast_available=True,
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "hourly": {
                    "time": ["2026-05-26T18:00"],
                    "cloud_cover": [20],
                    "precipitation_probability": [5],
                    "visibility": [20000],
                }
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        weather = OpenMeteoWeatherClient(client=client, base_url="https://api.open-meteo.com")
        hourly = await weather.get_hourly_weather(
            latitude=53.2,
            longitude=50.15,
            event_time_utc=datetime(2026, 5, 26, 18, 0, tzinfo=timezone.utc),
            timezone="UTC",
        )

    expected = {
        "condition": ObservationCondition.EXCELLENT.value,
        "cloud_cover": 20,
        "precipitation_probability": 5,
        "visibility_m": 20000,
    }
    actual = {
        "condition": score.label.value,
        "cloud_cover": hourly.cloud_cover if hourly else None,
        "precipitation_probability": hourly.precipitation_probability if hourly else None,
        "visibility_m": hourly.visibility_m if hourly else None,
    }
    return [
        CheckResult(
            feature="weather",
            name="Weather forecast and condition scoring match excellent sky",
            expected=expected,
            actual=actual,
            passed=actual == expected,
        )
    ]


async def verify_bot_city_flow() -> list[CheckResult]:
    from src.bot.handlers import (
        format_city_candidates,
        format_location_saved_message,
        format_no_events_message,
        format_visibility_pending_message,
    )
    from src.core.services.geocoding import GeocodingCandidate

    candidate = GeocodingCandidate(
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
    candidates_text = format_city_candidates([candidate])
    saved_text = format_location_saved_message(candidate.display_name)
    pending_text = format_visibility_pending_message(candidate.display_name)
    no_events_text = format_no_events_message(candidate.display_name, days=7)

    expected = {
        "candidate_mentions_city": True,
        "candidate_asks_to_choose": True,
        "saved_mentions_city": True,
        "saved_mentions_calculation": True,
        "pending_mentions_city": True,
        "pending_mentions_calculation": True,
        "no_events_mentions_city": True,
        "no_events_mentions_period": True,
    }
    actual = {
        "candidate_mentions_city": "Samara, Samara Oblast, Russia" in candidates_text,
        "candidate_asks_to_choose": "Выбери город" in candidates_text,
        "saved_mentions_city": "Samara, Samara Oblast, Russia" in saved_text,
        "saved_mentions_calculation": "считаю" in saved_text.lower(),
        "pending_mentions_city": "Samara, Samara Oblast, Russia" in pending_text,
        "pending_mentions_calculation": "еще считаю" in pending_text.lower(),
        "no_events_mentions_city": "Samara, Samara Oblast, Russia" in no_events_text,
        "no_events_mentions_period": "ближайшие 7 дней" in no_events_text,
    }
    return [
        CheckResult(
            feature="bot_city_flow",
            name="Telegram city flow copy contains city and calculation state",
            expected=expected,
            actual=actual,
            passed=actual == expected,
        )
    ]


async def run(selected: str) -> list[CheckResult]:
    if selected == "feature-flags":
        return await verify_feature_flags()
    if selected == "geocoding":
        return await verify_geocoding()
    if selected == "location-metadata":
        return await verify_location_metadata()
    if selected == "visibility-cache":
        return await verify_visibility_cache()
    if selected == "weather":
        return await verify_weather()
    if selected == "bot-city-flow":
        return await verify_bot_city_flow()
    if selected == "all":
        results: list[CheckResult] = []
        results.extend(await verify_feature_flags())
        results.extend(await verify_geocoding())
        results.extend(await verify_location_metadata())
        results.extend(await verify_visibility_cache())
        results.extend(await verify_weather())
        results.extend(await verify_bot_city_flow())
        return results
    raise ValueError(f"Unknown verification target: {selected}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "target",
        choices=[
            "all",
            "feature-flags",
            "geocoding",
            "location-metadata",
            "visibility-cache",
            "weather",
            "bot-city-flow",
        ],
        help="Verification target to run.",
    )
    args = parser.parse_args()

    results = asyncio.run(run(args.target))
    print(json.dumps([asdict(result) for result in results], indent=2, ensure_ascii=False))
    return 0 if all(result.passed for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
