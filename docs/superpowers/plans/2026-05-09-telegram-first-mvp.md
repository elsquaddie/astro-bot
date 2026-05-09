# Telegram-First MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AstroBot into a Telegram-first MVP that supports city-based locations, avoids misleading cache misses, adds weather-aware observation conditions, and disables the 3D/calendar prototype by default.

**Architecture:** Keep FastAPI, aiogram, PostgreSQL, SQLAlchemy, Alembic, and worker jobs. Add small service modules for geocoding, weather, and observation scoring. Keep the existing frontend code in the repository but gate its mounting and related API routes behind feature flags.

**Tech Stack:** Python 3.11, FastAPI, aiogram 3, SQLAlchemy async, PostgreSQL, Alembic, httpx, Skyfield, Open-Meteo Geocoding API, Open-Meteo Forecast API, pytest.

---

## File Structure

- Modify `src/config.py`: add `ENABLE_WEB_UI`, `ENABLE_SOLAR_SYSTEM_API`, `GEOCODING_PROVIDER`, `WEATHER_PROVIDER`, `OPEN_METEO_BASE_URL`, and `OPEN_METEO_GEOCODING_BASE_URL`.
- Modify `src/main.py`: include `solar_system_router` and mount `frontend/` only when feature flags are enabled.
- Modify `.env.example`: align defaults with safe local startup and new flags.
- Modify `README.md`: reposition the app as Telegram-first and mark 3D/calendar as optional prototype.
- Create `src/core/services/geocoding.py`: city search and Open-Meteo geocoding models.
- Create `src/core/services/weather.py`: weather forecast client and observation condition scoring inputs.
- Create `src/core/services/observation_conditions.py`: convert weather + astronomy visibility into user-facing condition labels.
- Modify `src/core/services/visibility.py`: add location-scoped cache builder for on-demand calculations.
- Modify `src/core/services/users.py`: return enough location data for immediate visibility calculation after location update.
- Modify `src/bot/handlers.py`: add text city flow, city selection callbacks, cache-miss handling, and improved notification copy.
- Modify `src/worker.py`: keep scheduled cache rebuilds, but do not rely on them for the first user experience.
- Add Alembic migration under `alembic/versions/`: store optional city display metadata on `locations`.
- Modify `src/core/models.py`: add optional `display_name`, `country_code`, `admin1`, and `source_location_id` to `Location`.
- Add tests:
  - `tests/test_feature_flags.py`
  - `tests/test_geocoding.py`
  - `tests/test_weather.py`
  - `tests/test_visibility_cache_miss.py`
  - `tests/test_bot_city_flow.py`

---

### Task 1: Disable 3D/calendar Prototype By Default

**Files:**
- Modify: `src/config.py`
- Modify: `src/main.py`
- Modify: `.env.example`
- Create: `tests/test_feature_flags.py`

- [ ] **Step 1: Write failing tests for default disabled routes**

Create `tests/test_feature_flags.py`:

```python
import importlib

import pytest
from httpx import ASGITransport, AsyncClient


def _reload_app(monkeypatch, *, web_ui: str = "false", solar_api: str = "false"):
    monkeypatch.setenv("ENABLE_WEB_UI", web_ui)
    monkeypatch.setenv("ENABLE_SOLAR_SYSTEM_API", solar_api)
    import src.config
    import src.main

    importlib.reload(src.config)
    return importlib.reload(src.main).app


@pytest.mark.asyncio
async def test_solar_system_api_disabled_by_default(monkeypatch):
    app = _reload_app(monkeypatch)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/solar-system")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_web_ui_disabled_by_default(monkeypatch):
    app = _reload_app(monkeypatch)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")

    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest tests/test_feature_flags.py -v
```

Expected: tests fail because `/api/solar-system` and `/` are still enabled whenever frontend files exist.

- [ ] **Step 3: Add settings**

In `src/config.py`, add:

```python
    # Optional prototype UI/API
    ENABLE_WEB_UI: bool = False
    ENABLE_SOLAR_SYSTEM_API: bool = False

    # External data providers
    GEOCODING_PROVIDER: str = "open-meteo"
    WEATHER_PROVIDER: str = "open-meteo"
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com"
    OPEN_METEO_GEOCODING_BASE_URL: str = "https://geocoding-api.open-meteo.com"
```

- [ ] **Step 4: Gate frontend and solar-system router**

In `src/main.py`, replace unconditional router inclusion and frontend mounting with:

```python
app.include_router(health_router)
app.include_router(api_router)

if settings.ENABLE_SOLAR_SYSTEM_API:
    app.include_router(solar_system_router)

if settings.ENABLE_WEB_UI and FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
```

- [ ] **Step 5: Update `.env.example`**

Set safe defaults:

```env
BOT_TOKEN=changeme
API_SECRET_KEY=changeme
ENABLE_WEB_UI=false
ENABLE_SOLAR_SYSTEM_API=false
GEOCODING_PROVIDER=open-meteo
WEATHER_PROVIDER=open-meteo
OPEN_METEO_BASE_URL=https://api.open-meteo.com
OPEN_METEO_GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com
```

- [ ] **Step 6: Run feature flag tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_feature_flags.py -v
```

Expected: both tests pass.

- [ ] **Step 7: Run full test suite**

Run:

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/config.py src/main.py .env.example tests/test_feature_flags.py
git commit -m "feat: gate prototype web UI behind feature flags"
```

---

### Task 2: Add City Geocoding Service

**Files:**
- Create: `src/core/services/geocoding.py`
- Create: `tests/test_geocoding.py`

- [ ] **Step 1: Write tests for Open-Meteo geocoding parsing**

Create `tests/test_geocoding.py`:

```python
import httpx
import pytest

from src.core.services.geocoding import OpenMeteoGeocoder


@pytest.mark.asyncio
async def test_search_city_returns_candidates():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["name"] == "Самара"
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

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        geocoder = OpenMeteoGeocoder(client=client, base_url="https://geocoding-api.open-meteo.com")
        results = await geocoder.search("Самара", language="ru")

    assert len(results) == 1
    assert results[0].source_location_id == 499099
    assert results[0].display_name == "Samara, Samara Oblast, Russia"
    assert results[0].latitude == 53.2001
    assert results[0].longitude == 50.15
    assert results[0].timezone == "Europe/Samara"


@pytest.mark.asyncio
async def test_get_city_by_id_returns_candidate():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["id"] == "499099"
        return httpx.Response(
            200,
            json={
                "id": 499099,
                "name": "Samara",
                "latitude": 53.2001,
                "longitude": 50.15,
                "timezone": "Europe/Samara",
                "country_code": "RU",
                "country": "Russia",
                "admin1": "Samara Oblast",
                "population": 1170000,
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        geocoder = OpenMeteoGeocoder(client=client, base_url="https://geocoding-api.open-meteo.com")
        result = await geocoder.get_by_id(499099, language="ru")

    assert result is not None
    assert result.display_name == "Samara, Samara Oblast, Russia"
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest tests/test_geocoding.py -v
```

Expected: import error because `src/core/services/geocoding.py` does not exist.

- [ ] **Step 3: Implement `src/core/services/geocoding.py`**

```python
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class GeocodingCandidate:
    source_location_id: int
    name: str
    display_name: str
    latitude: float
    longitude: float
    timezone: str
    country_code: str | None = None
    country: str | None = None
    admin1: str | None = None
    population: int | None = None


class OpenMeteoGeocoder:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        base_url: str = "https://geocoding-api.open-meteo.com",
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def search(
        self,
        query: str,
        *,
        language: str = "ru",
        count: int = 5,
    ) -> list[GeocodingCandidate]:
        if len(query.strip()) < 2:
            return []

        close_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=10.0)
        try:
            response = await client.get(
                f"{self._base_url}/v1/search",
                params={
                    "name": query.strip(),
                    "count": count,
                    "language": language,
                    "format": "json",
                },
            )
            response.raise_for_status()
            data = response.json()
        finally:
            if close_client:
                await client.aclose()

        return [_parse_candidate(item) for item in data.get("results", [])]

    async def get_by_id(
        self,
        source_location_id: int,
        *,
        language: str = "ru",
    ) -> GeocodingCandidate | None:
        close_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=10.0)
        try:
            response = await client.get(
                f"{self._base_url}/v1/get",
                params={
                    "id": str(source_location_id),
                    "language": language,
                    "format": "json",
                },
            )
            response.raise_for_status()
            data = response.json()
        finally:
            if close_client:
                await client.aclose()

        if not data or "id" not in data:
            return None
        return _parse_candidate(data)


def _parse_candidate(item: dict) -> GeocodingCandidate:
    parts = [
        item.get("name"),
        item.get("admin1"),
        item.get("country"),
    ]
    display_name = ", ".join(part for part in parts if part)
    return GeocodingCandidate(
        source_location_id=int(item["id"]),
        name=item["name"],
        display_name=display_name,
        latitude=float(item["latitude"]),
        longitude=float(item["longitude"]),
        timezone=item.get("timezone") or "UTC",
        country_code=item.get("country_code"),
        country=item.get("country"),
        admin1=item.get("admin1"),
        population=item.get("population"),
    )
```

- [ ] **Step 4: Run geocoding tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_geocoding.py -v
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/geocoding.py tests/test_geocoding.py
git commit -m "feat: add city geocoding service"
```

---

### Task 3: Store City Metadata On Locations

**Files:**
- Modify: `src/core/models.py`
- Modify: `src/core/services/users.py`
- Create: `alembic/versions/002_location_city_metadata.py`
- Modify: `tests/test_services.py`

- [ ] **Step 1: Add failing service test**

Append to `tests/test_services.py`:

```python
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

    assert user.location.display_name == "Samara, Samara Oblast, Russia"
    assert user.location.country_code == "RU"
    assert user.location.admin1 == "Samara Oblast"
    assert user.location.source_location_id == 499099
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest tests/test_services.py::test_set_user_location_with_city_metadata -v
```

Expected: `set_user_location()` does not accept metadata arguments.

- [ ] **Step 3: Update `Location` model**

Add to `Location` in `src/core/models.py`:

```python
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    admin1: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_location_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

- [ ] **Step 4: Add migration**

Create `alembic/versions/002_location_city_metadata.py`:

```python
"""Add city metadata to locations

Revision ID: 002
Revises: 001
Create Date: 2026-05-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("display_name", sa.String(255), nullable=True))
    op.add_column("locations", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("locations", sa.Column("admin1", sa.String(128), nullable=True))
    op.add_column("locations", sa.Column("source_location_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("locations", "source_location_id")
    op.drop_column("locations", "admin1")
    op.drop_column("locations", "country_code")
    op.drop_column("locations", "display_name")
```

- [ ] **Step 5: Update location services**

Replace `get_or_create_location()` and `set_user_location()` in `src/core/services/users.py` with versions that accept optional metadata and apply it when creating or reusing a rounded location:

```python
async def get_or_create_location(
    session: AsyncSession,
    latitude: float,
    longitude: float,
    tz: str,
    display_name: str | None = None,
    country_code: str | None = None,
    admin1: str | None = None,
    source_location_id: int | None = None,
) -> Location:
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
            display_name=display_name,
            country_code=country_code,
            admin1=admin1,
            source_location_id=source_location_id,
        )
        session.add(location)
        await session.flush()
    else:
        location.timezone = tz
        location.display_name = display_name or location.display_name
        location.country_code = country_code or location.country_code
        location.admin1 = admin1 or location.admin1
        location.source_location_id = source_location_id or location.source_location_id

    return location


async def set_user_location(
    session: AsyncSession,
    telegram_id: int,
    latitude: float,
    longitude: float,
    tz: str,
    display_name: str | None = None,
    country_code: str | None = None,
    admin1: str | None = None,
    source_location_id: int | None = None,
) -> User:
    user = await get_or_create_user(session, telegram_id)
    location = await get_or_create_location(
        session,
        latitude,
        longitude,
        tz,
        display_name=display_name,
        country_code=country_code,
        admin1=admin1,
        source_location_id=source_location_id,
    )
    user.location_id = location.id
    await session.commit()
    return user
```

- [ ] **Step 6: Run service tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_services.py -v
```

Expected: all service tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/models.py src/core/services/users.py alembic/versions/002_location_city_metadata.py tests/test_services.py
git commit -m "feat: store city metadata for locations"
```

---

### Task 4: Add On-Demand Visibility Calculation For New Locations

**Files:**
- Modify: `src/core/services/visibility.py`
- Create: `tests/test_visibility_cache_miss.py`

- [ ] **Step 1: Write failing test for location-scoped cache builder**

Create `tests/test_visibility_cache_miss.py`:

```python
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

    await build_visibility_cache_for_location(db_session, location.id, days_ahead=7)

    result = await db_session.execute(select(EventVisibilityCache))
    cache = result.scalar_one()
    assert cache.location_id == location.id
    assert cache.event_id == event.id
    assert cache.is_visible is True
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest tests/test_visibility_cache_miss.py -v
```

Expected: import error because `build_visibility_cache_for_location` does not exist.

- [ ] **Step 3: Implement location-scoped cache builder**

Add to `src/core/services/visibility.py`:

```python
async def build_visibility_cache_for_location(
    session: AsyncSession,
    location_id: int,
    days_ahead: int = 30,
) -> int:
    location = await session.get(Location, location_id)
    if location is None:
        return 0

    events = await get_candidate_events(session, days_ahead=days_ahead)
    computed = 0

    for event in events:
        if event.min_lat is not None:
            if not (
                event.min_lat <= location.latitude <= event.max_lat
                and event.min_lon <= location.longitude <= event.max_lon
            ):
                continue

        await compute_and_cache_visibility(session, event, location)
        computed += 1

    return computed
```

- [ ] **Step 4: Run visibility cache tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_visibility_cache_miss.py -v
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/visibility.py tests/test_visibility_cache_miss.py
git commit -m "feat: compute visibility on demand for new locations"
```

---

### Task 5: Add Weather-Aware Observation Conditions

**Files:**
- Create: `src/core/services/weather.py`
- Create: `src/core/services/observation_conditions.py`
- Create: `tests/test_weather.py`

- [ ] **Step 1: Write tests for weather scoring**

Create `tests/test_weather.py`:

```python
from datetime import datetime, timezone

from src.core.services.observation_conditions import (
    ObservationCondition,
    score_observation_conditions,
)


def test_score_excellent_conditions():
    result = score_observation_conditions(
        cloud_cover=20,
        precipitation_probability=5,
        visibility_m=20000,
        event_time_utc=datetime(2026, 5, 26, 18, 0, tzinfo=timezone.utc),
        forecast_available=True,
    )

    assert result.label == ObservationCondition.EXCELLENT
    assert "облачность около 20%" in result.summary


def test_score_poor_conditions():
    result = score_observation_conditions(
        cloud_cover=90,
        precipitation_probability=70,
        visibility_m=3000,
        event_time_utc=datetime(2026, 5, 26, 18, 0, tzinfo=timezone.utc),
        forecast_available=True,
    )

    assert result.label == ObservationCondition.POOR


def test_score_unknown_when_forecast_missing():
    result = score_observation_conditions(
        cloud_cover=None,
        precipitation_probability=None,
        visibility_m=None,
        event_time_utc=datetime(2026, 5, 26, 18, 0, tzinfo=timezone.utc),
        forecast_available=False,
    )

    assert result.label == ObservationCondition.UNKNOWN
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest tests/test_weather.py -v
```

Expected: import error because weather services do not exist.

- [ ] **Step 3: Implement condition scoring**

Create `src/core/services/observation_conditions.py`:

```python
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class ObservationCondition(StrEnum):
    EXCELLENT = "excellent"
    OK = "ok"
    POOR = "poor"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class ObservationConditionResult:
    label: ObservationCondition
    summary: str


def score_observation_conditions(
    *,
    cloud_cover: int | None,
    precipitation_probability: int | None,
    visibility_m: int | None,
    event_time_utc: datetime,
    forecast_available: bool,
) -> ObservationConditionResult:
    if not forecast_available:
        return ObservationConditionResult(
            label=ObservationCondition.UNKNOWN,
            summary="прогноз погоды пока недоступен для этой даты",
        )

    cloud = cloud_cover if cloud_cover is not None else 100
    rain = precipitation_probability if precipitation_probability is not None else 100
    visibility = visibility_m if visibility_m is not None else 0

    if cloud <= 35 and rain <= 20 and visibility >= 10000:
        label = ObservationCondition.EXCELLENT
        prefix = "условия хорошие"
    elif cloud <= 70 and rain <= 50 and visibility >= 5000:
        label = ObservationCondition.OK
        prefix = "условия средние"
    else:
        label = ObservationCondition.POOR
        prefix = "условия плохие"

    return ObservationConditionResult(
        label=label,
        summary=f"{prefix}: облачность около {cloud}%, вероятность осадков {rain}%",
    )
```

- [ ] **Step 4: Implement Open-Meteo weather client**

Create `src/core/services/weather.py`:

```python
from dataclasses import dataclass
from datetime import datetime

import httpx


@dataclass(frozen=True)
class HourlyWeather:
    cloud_cover: int | None
    precipitation_probability: int | None
    visibility_m: int | None


class OpenMeteoWeatherClient:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        base_url: str = "https://api.open-meteo.com",
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def get_hourly_weather(
        self,
        *,
        latitude: float,
        longitude: float,
        event_time_utc: datetime,
        timezone: str,
    ) -> HourlyWeather | None:
        close_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=10.0)
        try:
            response = await client.get(
                f"{self._base_url}/v1/forecast",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "hourly": "cloud_cover,precipitation_probability,visibility",
                    "forecast_days": 16,
                    "timezone": timezone,
                },
            )
            response.raise_for_status()
            data = response.json()
        finally:
            if close_client:
                await client.aclose()

        hourly = data.get("hourly") or {}
        times = hourly.get("time") or []
        target_hour = event_time_utc.replace(minute=0, second=0, microsecond=0)
        target_prefix = target_hour.isoformat().replace("+00:00", "")

        for index, time_value in enumerate(times):
            if str(time_value).startswith(target_prefix[:13]):
                return HourlyWeather(
                    cloud_cover=_get_index(hourly.get("cloud_cover"), index),
                    precipitation_probability=_get_index(
                        hourly.get("precipitation_probability"),
                        index,
                    ),
                    visibility_m=_get_index(hourly.get("visibility"), index),
                )

        return None


def _get_index(values: list | None, index: int) -> int | None:
    if values is None or index >= len(values):
        return None
    value = values[index]
    return None if value is None else int(value)
```

- [ ] **Step 5: Run weather tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_weather.py -v
```

Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/weather.py src/core/services/observation_conditions.py tests/test_weather.py
git commit -m "feat: score observation conditions from weather"
```

---

### Task 6: Wire City Flow Into Telegram Bot

**Files:**
- Modify: `src/bot/handlers.py`
- Create: `tests/test_bot_city_flow.py`

- [ ] **Step 1: Add tests for city search helper behavior**

Create `tests/test_bot_city_flow.py` with handler-level unit tests for helper functions extracted from `handlers.py`:

```python
from src.bot.handlers import format_city_candidates, format_location_saved_message
from src.core.services.geocoding import GeocodingCandidate


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


def test_format_location_saved_message():
    text = format_location_saved_message("Samara, Samara Oblast, Russia")

    assert "Samara, Samara Oblast, Russia" in text
    assert "считаю" in text.lower()
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py -v
```

Expected: helper functions do not exist.

- [ ] **Step 3: Add helper functions and text handler**

In `src/bot/handlers.py`, add:

```python
from src.config import settings
from src.core.services.geocoding import GeocodingCandidate, OpenMeteoGeocoder
from src.core.services.visibility import build_visibility_cache_for_location


def format_city_candidates(candidates: list[GeocodingCandidate]) -> str:
    lines = ["Выбери город:"]
    for index, candidate in enumerate(candidates, start=1):
        lines.append(f"{index}. {candidate.display_name}")
    return "\n".join(lines)


def format_location_saved_message(display_name: str) -> str:
    return (
        f"Локация сохранена: {display_name}\n\n"
        "Сейчас считаю, какие события будет видно отсюда."
    )
```

Add text handler after `handle_location()` and before command handlers that need location:

```python
@router.message(F.text & ~F.text.startswith("/"))
async def handle_city_text(message: Message, session: AsyncSession) -> None:
    query = message.text.strip()
    geocoder = OpenMeteoGeocoder(
        base_url=settings.OPEN_METEO_GEOCODING_BASE_URL,
    )
    candidates = await geocoder.search(query, language="ru", count=5)

    if not candidates:
        await message.answer(
            "Я не нашел такой город. Попробуй написать город и страну, например: Самара, Россия."
        )
        return

    if len(candidates) == 1:
        await save_city_candidate(message, session, candidates[0])
        return

    buttons = []
    for candidate in candidates[:5]:
        buttons.append([
            InlineKeyboardButton(
                text=candidate.display_name[:60],
                callback_data=f"city:{candidate.source_location_id}",
            )
        ])

    await message.answer(
        format_city_candidates(candidates[:5]),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
```

Add `save_city_candidate()` and the city-selection callback:

```python
async def save_city_candidate(
    message: Message,
    session: AsyncSession,
    telegram_id: int,
    candidate: GeocodingCandidate,
) -> None:
    user = await set_user_location(
        session,
        telegram_id,
        candidate.latitude,
        candidate.longitude,
        candidate.timezone,
        display_name=candidate.display_name,
        country_code=candidate.country_code,
        admin1=candidate.admin1,
        source_location_id=candidate.source_location_id,
    )
    await build_visibility_cache_for_location(session, user.location_id, days_ahead=30)
    await message.answer(format_location_saved_message(candidate.display_name))


@router.callback_query(F.data.startswith("city:"))
async def select_city(callback: CallbackQuery, session: AsyncSession) -> None:
    source_location_id = int(callback.data.split(":", 1)[1])
    geocoder = OpenMeteoGeocoder(
        base_url=settings.OPEN_METEO_GEOCODING_BASE_URL,
    )
    candidate = await geocoder.get_by_id(source_location_id, language="ru")

    if candidate is None:
        await callback.answer("Город не найден, попробуй написать название еще раз.")
        return

    await save_city_candidate(
        callback.message,
        session,
        callback.from_user.id,
        candidate,
    )
    await callback.answer("Город сохранен")
```

- [ ] **Step 4: Trigger on-demand visibility after saving city**

Verify that `save_city_candidate()` contains this sequence:

```python
    user = await set_user_location(
        session,
        telegram_id,
        candidate.latitude,
        candidate.longitude,
        candidate.timezone,
        display_name=candidate.display_name,
        country_code=candidate.country_code,
        admin1=candidate.admin1,
        source_location_id=candidate.source_location_id,
    )
    await build_visibility_cache_for_location(session, user.location_id, days_ahead=30)
    await message.answer(format_location_saved_message(candidate.display_name))
```

- [ ] **Step 5: Run city flow tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py -v
```

Expected: tests pass.

- [ ] **Step 6: Run full tests**

Run:

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/bot/handlers.py tests/test_bot_city_flow.py
git commit -m "feat: support city-based Telegram locations"
```

---

### Task 7: Improve `/today` Cache-Miss Messaging

**Files:**
- Modify: `src/bot/handlers.py`
- Modify: `tests/test_bot_city_flow.py`

- [ ] **Step 1: Add helper tests for `/today` empty states**

Append to `tests/test_bot_city_flow.py`:

```python
from src.bot.handlers import format_no_events_message, format_visibility_pending_message


def test_format_visibility_pending_message():
    text = format_visibility_pending_message("Samara, Samara Oblast, Russia")

    assert "еще считаю" in text.lower()
    assert "Samara" in text


def test_format_no_events_message():
    text = format_no_events_message("Samara, Samara Oblast, Russia", days=7)

    assert "ближайшие 7 дней" in text
    assert "Samara" in text
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py::test_format_visibility_pending_message tests/test_bot_city_flow.py::test_format_no_events_message -v
```

Expected: helper functions do not exist.

- [ ] **Step 3: Add message helpers**

In `src/bot/handlers.py`, add:

```python
def format_visibility_pending_message(location_name: str) -> str:
    return (
        f"Я еще считаю видимость событий для {location_name}. "
        "Попробуй еще раз через несколько секунд, либо я пришлю результат сам."
    )


def format_no_events_message(location_name: str, days: int) -> str:
    return f"Для {location_name} в ближайшие {days} дней заметных событий не нашел."
```

- [ ] **Step 4: Update `/today` query flow**

In `cmd_today()`:

Before returning "no events", check whether any cache rows exist for the user's location. If none exist, compute visibility once and rerun the visible-event query:

```python
location = await session.get(Location, user.location_id)
location_name = location.display_name if location and location.display_name else "твоей локации"

cache_stmt = select(EventVisibilityCache.id).where(
    EventVisibilityCache.location_id == user.location_id,
).limit(1)
cache_result = await session.execute(cache_stmt)
has_cache = cache_result.scalar_one_or_none() is not None

if not has_cache:
    try:
        await build_visibility_cache_for_location(session, user.location_id, days_ahead=30)
    except Exception:
        await message.answer(format_visibility_pending_message(location_name))
        return

    result = await session.execute(stmt)
    rows = result.all()

if not rows:
    await message.answer(format_no_events_message(location_name, days=7))
    return
```

- [ ] **Step 5: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py tests/test_visibility_cache_miss.py -v
```

Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/bot/handlers.py tests/test_bot_city_flow.py
git commit -m "fix: avoid misleading empty event messages"
```

---

### Task 8: Update README For Telegram-First MVP

**Files:**
- Modify: `README.md`
- Reference: `docs/product/telegram-first-mvp-features.md`

- [ ] **Step 1: Update product description**

Replace the opening description with:

```markdown
Telegram-first bot for discovering astronomical events visible from a user's city or location. AstroBot helps users avoid missing eclipses, meteor showers, supermoons, and other sky events by combining event data, local visibility calculations, weather conditions, and configurable reminders.
```

- [ ] **Step 2: Mark web UI as optional prototype**

Add:

```markdown
## Optional Prototype UI

The old 3D Solar System frontend and yearly visual calendar are kept as a prototype and are disabled by default.

To enable them locally:

```env
ENABLE_WEB_UI=true
ENABLE_SOLAR_SYSTEM_API=true
```
```

- [ ] **Step 3: Update local setup notes**

Document:

```markdown
BOT_TOKEN=changeme keeps Telegram startup disabled for API-only local checks.
Set a real BotFather token only when testing Telegram polling or webhook mode.
```

- [ ] **Step 4: Run docs-adjacent smoke checks**

Run:

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/product/telegram-first-mvp-features.md docs/superpowers/plans/2026-05-09-telegram-first-mvp.md
git commit -m "docs: define telegram-first mvp plan"
```

---

## Verification Checklist

- [ ] `docker compose up -d` starts PostgreSQL.
- [ ] `.venv/bin/alembic upgrade head` applies migrations.
- [ ] `.venv/bin/python -m src.data.seed_db` seeds events idempotently.
- [ ] `.venv/bin/python -m pytest tests/ -v` passes.
- [ ] With default flags, `/api/solar-system` is 404.
- [ ] With default flags, `/` is 404 unless another explicit root route is added.
- [ ] With `ENABLE_WEB_UI=true` and `ENABLE_SOLAR_SYSTEM_API=true`, prototype UI/API can still be tested.
- [ ] Telegram user can set location through GPS.
- [ ] Telegram user can set location through city text.
- [ ] `/today` never uses cache miss wording that implies there are definitely no events.
- [ ] Weather API failure does not block astronomical notifications.

## External References

- Open-Meteo Weather Forecast API: https://open-meteo.com/en/docs
- Open-Meteo Geocoding API: https://open-meteo.com/en/docs/geocoding-api
- Open-Meteo pricing and open-access limits: https://open-meteo.com/en/pricing
