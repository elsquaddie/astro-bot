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
