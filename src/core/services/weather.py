"""Weather forecast client for observation condition checks."""
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo

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
        target_hour = _local_hour_key(event_time_utc, timezone)

        for index, time_value in enumerate(times):
            if str(time_value) == target_hour:
                return HourlyWeather(
                    cloud_cover=_get_index(hourly.get("cloud_cover"), index),
                    precipitation_probability=_get_index(
                        hourly.get("precipitation_probability"),
                        index,
                    ),
                    visibility_m=_get_index(hourly.get("visibility"), index),
                )

        return None


def _local_hour_key(event_time_utc: datetime, timezone: str) -> str:
    if event_time_utc.tzinfo is None:
        event_time_utc = event_time_utc.replace(tzinfo=dt_timezone.utc)

    try:
        local_tz = ZoneInfo(timezone)
    except (KeyError, ValueError):
        local_tz = dt_timezone.utc

    local_time = event_time_utc.astimezone(local_tz)
    return local_time.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


def _get_index(values: list | None, index: int) -> int | None:
    if values is None or index >= len(values):
        return None
    value = values[index]
    return None if value is None else int(value)
