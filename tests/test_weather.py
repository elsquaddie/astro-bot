from datetime import datetime, timezone

import httpx
import pytest

from src.core.services.observation_conditions import (
    ObservationCondition,
    score_observation_conditions,
)
from src.core.services.weather import OpenMeteoWeatherClient


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


@pytest.mark.asyncio
async def test_open_meteo_weather_client_returns_matching_hour():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["latitude"] == "53.2"
        assert request.url.params["longitude"] == "50.15"
        assert request.url.params["timezone"] == "UTC"
        return httpx.Response(
            200,
            json={
                "hourly": {
                    "time": ["2026-05-26T17:00", "2026-05-26T18:00"],
                    "cloud_cover": [90, 20],
                    "precipitation_probability": [80, 5],
                    "visibility": [3000, 20000],
                }
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        weather = OpenMeteoWeatherClient(
            client=client,
            base_url="https://api.open-meteo.com",
        )
        result = await weather.get_hourly_weather(
            latitude=53.2,
            longitude=50.15,
            event_time_utc=datetime(2026, 5, 26, 18, 30, tzinfo=timezone.utc),
            timezone="UTC",
        )

    assert result is not None
    assert result.cloud_cover == 20
    assert result.precipitation_probability == 5
    assert result.visibility_m == 20000
