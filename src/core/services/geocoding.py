"""City geocoding service backed by Open-Meteo."""
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
