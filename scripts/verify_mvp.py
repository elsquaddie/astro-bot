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

import httpx
from httpx import ASGITransport, AsyncClient


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


async def run(selected: str) -> list[CheckResult]:
    if selected == "feature-flags":
        return await verify_feature_flags()
    if selected == "geocoding":
        return await verify_geocoding()
    if selected == "location-metadata":
        return await verify_location_metadata()
    if selected == "all":
        results: list[CheckResult] = []
        results.extend(await verify_feature_flags())
        results.extend(await verify_geocoding())
        results.extend(await verify_location_metadata())
        return results
    raise ValueError(f"Unknown verification target: {selected}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "target",
        choices=["all", "feature-flags", "geocoding", "location-metadata"],
        help="Verification target to run.",
    )
    args = parser.parse_args()

    results = asyncio.run(run(args.target))
    print(json.dumps([asdict(result) for result in results], indent=2, ensure_ascii=False))
    return 0 if all(result.passed for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
