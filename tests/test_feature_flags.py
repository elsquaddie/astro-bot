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
