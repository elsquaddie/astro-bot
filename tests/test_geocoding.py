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
        geocoder = OpenMeteoGeocoder(
            client=client,
            base_url="https://geocoding-api.open-meteo.com",
        )
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
        geocoder = OpenMeteoGeocoder(
            client=client,
            base_url="https://geocoding-api.open-meteo.com",
        )
        result = await geocoder.get_by_id(499099, language="ru")

    assert result is not None
    assert result.display_name == "Samara, Samara Oblast, Russia"
