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


async def run(selected: str) -> list[CheckResult]:
    if selected == "feature-flags":
        return await verify_feature_flags()
    if selected == "geocoding":
        return await verify_geocoding()
    if selected == "location-metadata":
        return await verify_location_metadata()
    if selected == "visibility-cache":
        return await verify_visibility_cache()
    if selected == "all":
        results: list[CheckResult] = []
        results.extend(await verify_feature_flags())
        results.extend(await verify_geocoding())
        results.extend(await verify_location_metadata())
        results.extend(await verify_visibility_cache())
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
        ],
        help="Verification target to run.",
    )
    args = parser.parse_args()

    results = asyncio.run(run(args.target))
    print(json.dumps([asdict(result) for result in results], indent=2, ensure_ascii=False))
    return 0 if all(result.passed for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
