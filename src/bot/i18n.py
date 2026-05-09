"""Small Telegram i18n layer for supported bot languages."""
from __future__ import annotations

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = {"ru", "en"}


TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "start": (
            "Welcome to AstroBot!\n\n"
            "I'll notify you about astronomical events visible from your location.\n\n"
            "Please share your location or send me a city name."
        ),
        "send_location_button": "Send location",
        "city_candidates": "Choose a city:",
        "city_not_found": (
            "I couldn't find that city. Try sending the city and country, "
            "for example: Samara, Russia."
        ),
        "location_saved": (
            "Location saved: {display_name}\n\n"
            "I'm calculating which events will be visible from there."
        ),
        "coordinates_saved": (
            "Location saved: {latitude:.2f}, {longitude:.2f}\n"
            "Timezone: {timezone}\n\n"
            "Use /today to see today's events or /settings to configure notifications."
        ),
        "visibility_pending": (
            "I'm still calculating event visibility for {location_name}. "
            "Try again in a few seconds, or I'll send the result when it is ready."
        ),
        "no_events": "No notable events found for {location_name} in the next {days} days.",
        "city_not_found_callback": "City not found. Try sending the city name again.",
        "city_saved_callback": "City saved",
        "fallback_location_name": "your location",
        "set_location_first": "Please set your location first with /start",
        "register_first": "Please register first with /start",
        "today_header": "Upcoming astronomical events:",
        "best_viewing": "best viewing: {time}",
        "event_type_solar_eclipse": "Solar eclipse",
        "event_type_lunar_eclipse": "Lunar eclipse",
        "event_type_meteor_peak": "Meteor shower peak",
        "event_type_supermoon": "Supermoon",
        "event_type_unknown": "{event_type}",
        "settings_title": "Notification settings:",
        "status_on": "ON",
        "status_off": "OFF",
        "settings_rare_line": "Rare events (eclipses): {status}",
        "settings_regular_line": "Regular events (meteors, supermoons): {status}",
        "settings_rare_button": "Rare events: {status}",
        "settings_regular_button": "Regular events: {status}",
        "settings_alert_12_button": "Set alert time: 12h before",
        "settings_alert_24_button": "24h before",
        "settings_alert_48_button": "48h before",
        "toggle_rare_callback": "Rare events: {status}",
        "toggle_regular_callback": "Regular events: {status}",
        "alert_time_callback": "Alert time set to {hours}h before event",
        "language_prompt": "Choose bot language:",
        "language_updated": "Language updated to English",
    },
    "ru": {
        "start": (
            "Добро пожаловать в AstroBot!\n\n"
            "Я буду напоминать об астрономических событиях, которые видно из твоей локации.\n\n"
            "Отправь геолокацию или напиши название города."
        ),
        "send_location_button": "Отправить геолокацию",
        "city_candidates": "Выбери город:",
        "city_not_found": (
            "Я не нашел такой город. Попробуй написать город и страну, "
            "например: Самара, Россия."
        ),
        "location_saved": (
            "Локация сохранена: {display_name}\n\n"
            "Сейчас считаю, какие события будет видно отсюда."
        ),
        "coordinates_saved": (
            "Локация сохранена: {latitude:.2f}, {longitude:.2f}\n"
            "Часовой пояс: {timezone}\n\n"
            "Используй /today, чтобы посмотреть ближайшие события, или /settings, чтобы настроить уведомления."
        ),
        "visibility_pending": (
            "Я еще считаю видимость событий для {location_name}. "
            "Попробуй еще раз через несколько секунд, либо я пришлю результат сам."
        ),
        "no_events": "Для {location_name} в ближайшие {days} дней заметных событий не нашел.",
        "city_not_found_callback": "Город не найден, попробуй написать название еще раз.",
        "city_saved_callback": "Город сохранен",
        "fallback_location_name": "твоей локации",
        "set_location_first": "Сначала задай локацию через /start",
        "register_first": "Сначала зарегистрируйся через /start",
        "today_header": "Ближайшие астрономические события:",
        "best_viewing": "лучшее время наблюдения: {time}",
        "event_type_solar_eclipse": "Солнечное затмение",
        "event_type_lunar_eclipse": "Лунное затмение",
        "event_type_meteor_peak": "Пик метеорного потока",
        "event_type_supermoon": "Суперлуние",
        "event_type_unknown": "{event_type}",
        "settings_title": "Настройки уведомлений:",
        "status_on": "ВКЛ",
        "status_off": "ВЫКЛ",
        "settings_rare_line": "Редкие события (затмения): {status}",
        "settings_regular_line": "Регулярные события (метеоры, суперлуния): {status}",
        "settings_rare_button": "Редкие события: {status}",
        "settings_regular_button": "Регулярные события: {status}",
        "settings_alert_12_button": "Напомнить за 12 часов",
        "settings_alert_24_button": "За 24 часа",
        "settings_alert_48_button": "За 48 часов",
        "toggle_rare_callback": "Редкие события: {status}",
        "toggle_regular_callback": "Регулярные события: {status}",
        "alert_time_callback": "Напоминание за {hours} ч. до события",
        "language_prompt": "Выбери язык бота:",
        "language_updated": "Язык изменен на русский",
    },
}


LANGUAGE_NAMES: dict[str, dict[str, str]] = {
    "en": {
        "en": "English",
        "ru": "Russian",
    },
    "ru": {
        "en": "Английский",
        "ru": "Русский",
    },
}


def normalize_language_code(language_code: str | None) -> str:
    if not language_code:
        return DEFAULT_LANGUAGE

    normalized = language_code.lower().replace("_", "-").split("-", maxsplit=1)[0]
    if normalized in SUPPORTED_LANGUAGES:
        return normalized
    return DEFAULT_LANGUAGE


def all_translation_keys() -> dict[str, set[str]]:
    return {language: set(messages) for language, messages in TRANSLATIONS.items()}


def t(language_code: str | None, key: str, **params: object) -> str:
    language = normalize_language_code(language_code)
    try:
        template = TRANSLATIONS[language][key]
    except KeyError as exc:
        raise KeyError(f"Missing translation key {key!r} for language {language!r}") from exc
    return template.format(**params)


def language_name(language_code: str, viewer_language_code: str | None) -> str:
    language = normalize_language_code(language_code)
    viewer_language = normalize_language_code(viewer_language_code)
    return LANGUAGE_NAMES[viewer_language][language]
