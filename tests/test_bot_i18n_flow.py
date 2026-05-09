from src.bot.handlers import cmd_language, cmd_start, handle_city_text, select_language
from src.core.services.geocoding import GeocodingCandidate
from src.core.services.users import get_or_create_user, get_user_by_telegram_id


class FakeFromUser:
    def __init__(self, telegram_id=123456, language_code="en"):
        self.id = telegram_id
        self.language_code = language_code


class FakeMessage:
    def __init__(self, telegram_id=123456, language_code="en", text="Samara"):
        self.from_user = FakeFromUser(telegram_id=telegram_id, language_code=language_code)
        self.text = text
        self.answers = []

    async def answer(self, text, **kwargs):
        self.answers.append({"text": text, "kwargs": kwargs})


class FakeCallback:
    def __init__(self, telegram_id=123456, language_code="ru", data="lang:en"):
        self.from_user = FakeFromUser(telegram_id=telegram_id, language_code=language_code)
        self.data = data
        self.message = FakeMessage(telegram_id=telegram_id, language_code=language_code)
        self.answers = []

    async def answer(self, text=None, **kwargs):
        self.answers.append({"text": text, "kwargs": kwargs})


async def test_start_uses_telegram_language_code(db_session):
    message = FakeMessage(language_code="ru")

    await cmd_start(message, db_session)

    user = await get_user_by_telegram_id(db_session, message.from_user.id)
    assert user.language_code == "ru"
    assert "Добро пожаловать" in message.answers[0]["text"]

    keyboard = message.answers[0]["kwargs"]["reply_markup"]
    assert keyboard.keyboard[0][0].text == "Отправить геолокацию"


async def test_language_command_renders_selector_in_current_language(db_session):
    await get_or_create_user(db_session, telegram_id=555, language_code="ru")
    message = FakeMessage(telegram_id=555, language_code="ru")

    await cmd_language(message, db_session)

    assert "Выбери язык" in message.answers[0]["text"]
    keyboard = message.answers[0]["kwargs"]["reply_markup"]
    button_texts = [button.text for row in keyboard.inline_keyboard for button in row]
    assert "Русский" in button_texts
    assert "Английский" in button_texts


async def test_language_callback_updates_user_and_answers_in_selected_language(db_session):
    await get_or_create_user(db_session, telegram_id=777, language_code="ru")
    callback = FakeCallback(telegram_id=777, data="lang:en")

    await select_language(callback, db_session)

    user = await get_user_by_telegram_id(db_session, 777)
    assert user.language_code == "en"
    assert callback.answers[0]["text"] == "Language updated to English"


async def test_city_text_uses_saved_user_language_for_geocoding(db_session, monkeypatch):
    await get_or_create_user(db_session, telegram_id=888, language_code="en")
    captured = {}

    class FakeGeocoder:
        def __init__(self, **kwargs):
            pass

        async def search(self, query, *, language, count):
            captured["query"] = query
            captured["language"] = language
            captured["count"] = count
            return [
                GeocodingCandidate(
                    source_location_id=5128581,
                    name="New York",
                    display_name="New York, United States",
                    latitude=40.7143,
                    longitude=-74.006,
                    timezone="America/New_York",
                    country_code="US",
                    country="United States",
                    admin1="New York",
                    population=8800000,
                )
            ]

    async def fake_build_visibility_cache_for_location(session, location_id, days_ahead=30):
        return 0

    monkeypatch.setattr("src.bot.handlers.OpenMeteoGeocoder", FakeGeocoder)
    monkeypatch.setattr(
        "src.bot.handlers.build_visibility_cache_for_location",
        fake_build_visibility_cache_for_location,
    )

    message = FakeMessage(telegram_id=888, language_code="en", text="New York")
    await handle_city_text(message, db_session)

    assert captured == {"query": "New York", "language": "en", "count": 5}
    assert "Location saved" in message.answers[0]["text"]
