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


async def run(selected: str) -> list[CheckResult]:
    if selected == "feature-flags":
        return await verify_feature_flags()
    if selected == "all":
        return await verify_feature_flags()
    raise ValueError(f"Unknown verification target: {selected}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "target",
        choices=["all", "feature-flags"],
        help="Verification target to run.",
    )
    args = parser.parse_args()

    results = asyncio.run(run(args.target))
    print(json.dumps([asdict(result) for result in results], indent=2, ensure_ascii=False))
    return 0 if all(result.passed for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
