"""Tests for REST API endpoints."""
import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.database import get_db
from src.core.models import Base
from src.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://astro:astro_pass@localhost:5432/astro_bot_test",
)


@pytest.fixture
def api_key():
    return settings.API_SECRET_KEY


async def _override_get_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ready():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_events_today_no_api_key():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/events/today", params={"lat": 55.75, "lon": 37.61})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_events_today_with_api_key(api_key):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/events/today",
            params={"lat": 55.75, "lon": 37.61},
            headers={"X-API-Key": api_key},
        )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_user(api_key):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/users",
            json={
                "telegram_id": 55555,
                "latitude": 55.75,
                "longitude": 37.61,
                "timezone": "Europe/Moscow",
            },
            headers={"X-API-Key": api_key},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["telegram_id"] == 55555
    assert data["location_id"] is not None
