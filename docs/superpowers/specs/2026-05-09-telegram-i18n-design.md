# Telegram I18n Design

## Goal

AstroBot supports Russian and English user-facing Telegram UX without changing the astronomy domain model. The bot detects a user's Telegram language on `/start`, lets the user switch language with `/language`, and uses that language for city search, buttons, settings, and event copy.

## Scope

- Supported languages: `ru`, `en`.
- Fallback language: `en`.
- Telegram `from_user.language_code` is normalized to `ru` or `en`; variants like `ru-RU` map to `ru`.
- The database stores `User.language_code`.
- The geocoder receives the user's language code so city names are returned in the best available locale.
- Event types remain stable internal codes such as `meteor_peak`; presentation converts them to localized labels.
- No machine translation at runtime.

## Architecture

Add a small `src/bot/i18n.py` module that owns language normalization, translation dictionaries, and simple template formatting. Bot handlers ask for the current user language and call `t(lang, key, **params)` instead of embedding user-facing strings directly.

User language is persisted in `users.language_code` through an Alembic migration. `get_or_create_user()` accepts an optional language code and updates the user when Telegram provides a supported language. A `/language` command shows inline buttons for Russian and English; callbacks update the stored language and acknowledge in the newly selected language.

## Data Flow

1. User opens `/start`.
2. Bot normalizes `message.from_user.language_code`.
3. Bot creates or updates `User.language_code`.
4. Bot replies in that language.
5. City search and city lookup pass the stored language to Open-Meteo.
6. Later commands read `user.language_code` and localize responses.

## Error Handling

Unsupported or missing Telegram language falls back to English. Missing translation keys raise an error in tests and verification, not silently in production. If a user has no row yet, command handlers infer language from Telegram metadata and create the user where appropriate.

## Testing

Pytest covers language normalization, translation key completeness, user language persistence, `/language` callbacks, localized city flow copy, and localized `/today` copy. `scripts/verify_mvp.py i18n` independently checks that all translation keys exist in `ru/en`, fallback works, and representative Russian and English messages render with expected content.
