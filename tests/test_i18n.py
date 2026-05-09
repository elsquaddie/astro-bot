import pytest

from src.bot.i18n import (
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    all_translation_keys,
    language_name,
    normalize_language_code,
    t,
)


def test_normalize_language_code_supports_telegram_variants():
    assert normalize_language_code("ru") == "ru"
    assert normalize_language_code("ru-RU") == "ru"
    assert normalize_language_code("en-US") == "en"
    assert normalize_language_code("de") == DEFAULT_LANGUAGE
    assert normalize_language_code(None) == DEFAULT_LANGUAGE


def test_translation_keys_match_between_supported_languages():
    keys_by_language = all_translation_keys()

    assert set(keys_by_language) == SUPPORTED_LANGUAGES
    assert keys_by_language["ru"] == keys_by_language["en"]
    assert "start" in keys_by_language["ru"]
    assert "city_not_found" in keys_by_language["en"]


def test_translate_renders_language_specific_templates():
    assert "локацию" in t("ru", "set_location_first")
    assert "location" in t("en", "set_location_first")
    assert "Самара" in t("ru", "location_saved", display_name="Самара")
    assert "Samara" in t("en", "location_saved", display_name="Samara")


def test_translate_falls_back_to_english_for_unknown_language():
    assert t("de", "set_location_first") == t("en", "set_location_first")


def test_missing_translation_key_raises_key_error():
    with pytest.raises(KeyError):
        t("ru", "missing_key")


def test_language_name_is_localized_for_selector_buttons():
    assert language_name("ru", "ru") == "Русский"
    assert language_name("en", "ru") == "Английский"
    assert language_name("ru", "en") == "Russian"
    assert language_name("en", "en") == "English"
