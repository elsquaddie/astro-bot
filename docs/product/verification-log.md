# Telegram-First MVP Verification Log

Дата: 2026-05-09

Этот файл фиксирует expected vs actual после каждой реализованной фичи. Полная автоматическая проверка находится в `scripts/verify_mvp.py`.

## Baseline

Command:

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected:

- 23 tests pass before feature work starts.

Actual:

- 23 tests passed in 2.30s.

## Feature 1: Feature Flags For Prototype UI/API

RED:

- Expected: `/` and `/api/solar-system` still return 200 before implementation, so new tests expecting 404 fail.
- Actual: `tests/test_feature_flags.py` failed with `200 != 404` for both routes.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_feature_flags.py -v
.venv/bin/python scripts/verify_mvp.py feature-flags
.venv/bin/python -m pytest tests/ -v
```

Expected:

- `/health` returns 200.
- `/` returns 404 by default.
- `/api/solar-system` returns 404 by default.
- Full suite passes.

Actual:

- Independent verifier matched all expected status codes.
- 25 tests passed in 2.11s.

## Feature 2: City Geocoding Service

RED:

- Expected: importing `src.core.services.geocoding` fails before implementation.
- Actual: `ModuleNotFoundError: No module named 'src.core.services.geocoding'`.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_geocoding.py -v
.venv/bin/python scripts/verify_mvp.py geocoding
.venv/bin/python -m pytest tests/ -v
```

Expected:

- Synthetic Open-Meteo geocoding response parses to one candidate.
- Candidate display name is `Samara, Samara Oblast, Russia`.
- Candidate timezone is `Europe/Samara`.

Actual:

- Independent verifier matched count, display name, and timezone.
- 27 tests passed in 2.22s.

## Feature 3: City Metadata On Locations

RED:

- Expected: `set_user_location()` rejects `display_name` before implementation.
- Actual: `TypeError: set_user_location() got an unexpected keyword argument 'display_name'`.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_services.py::test_set_user_location_with_city_metadata -v
.venv/bin/python scripts/verify_mvp.py location-metadata
.venv/bin/alembic upgrade head
.venv/bin/python -m pytest tests/ -v
```

Expected:

- `Location` exposes `display_name`, `country_code`, `admin1`, `source_location_id`.
- Alembic applies migration `001 -> 002`.
- Full suite passes.

Actual:

- Independent verifier matched all location metadata columns.
- Alembic applied `001 -> 002`.
- 28 tests passed in 2.23s.

## Feature 4: On-demand Visibility Cache

RED:

- Expected: importing `build_visibility_cache_for_location` fails before implementation.
- Actual: import error for missing function.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_visibility_cache_miss.py -v
.venv/bin/python scripts/verify_mvp.py visibility-cache
.venv/bin/python -m pytest tests/ -v
```

Expected:

- On-demand builder computes 1 event for 1 location.
- Cache contains 1 visibility row.
- Full suite passes.

Actual:

- Independent verifier matched `computed_count=1` and `cache_count=1`.
- 29 tests passed in 3.07s.

## Feature 5: Weather-aware Observation Conditions

RED:

- Expected: importing `observation_conditions` fails before implementation.
- Actual: `ModuleNotFoundError` for `src.core.services.observation_conditions`.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_weather.py -v
.venv/bin/python scripts/verify_mvp.py weather
.venv/bin/python -m pytest tests/ -v
```

Expected:

- Excellent weather score for cloud cover 20%, rain probability 5%, visibility 20000m.
- Open-Meteo hourly response maps matching hour to same values.
- Full suite passes.

Actual:

- Independent verifier matched `condition=excellent`, `cloud_cover=20`, `precipitation_probability=5`, `visibility_m=20000`.
- 33 tests passed in 2.99s.

## Feature 6: Telegram City Flow

RED:

- Expected: importing `format_city_candidates` fails before implementation.
- Actual: import error for missing helper.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py -v
.venv/bin/python scripts/verify_mvp.py bot-city-flow
.venv/bin/python -m pytest tests/ -v
```

Expected:

- City candidate text mentions city and asks user to choose.
- Saved-location text mentions city and calculation state.
- Full suite passes.

Actual:

- Independent verifier matched all city-flow copy checks.
- 35 tests passed in 4.28s.

## Feature 7: Cache-miss Messaging For `/today`

RED:

- Expected: importing `format_no_events_message` fails before implementation.
- Actual: import error for missing helper.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_bot_city_flow.py -v
.venv/bin/python scripts/verify_mvp.py bot-city-flow
.venv/bin/python -m pytest tests/ -v
```

Expected:

- `/today` builds missing cache before answering.
- Pending text says calculation is still in progress.
- No-events text mentions city and period.
- Full suite passes.

Actual:

- Bot flow tests passed.
- Independent verifier matched pending/no-events copy checks.
- 38 tests passed in 3.80s.

## Feature 8: Telegram I18n For Russian And English

RED:

- Expected: importing `src.bot.i18n` fails before the translation module exists.
- Actual: `ModuleNotFoundError: No module named 'src.bot.i18n'`.
- Expected: `get_or_create_user(language_code=...)` fails before user language persistence exists.
- Actual: `TypeError: get_or_create_user() got an unexpected keyword argument 'language_code'`.
- Expected: importing `/language` handlers fails before Telegram language switching exists.
- Actual: `ImportError: cannot import name 'cmd_language' from 'src.bot.handlers'`.
- Expected: `scripts.verify_mvp.run("i18n")` fails before independent i18n verification exists.
- Actual: `ValueError: Unknown verification target: i18n`.

GREEN:

Commands:

```bash
.venv/bin/python -m pytest tests/test_i18n.py -v
.venv/bin/python -m pytest tests/test_services.py -v
.venv/bin/alembic upgrade head
.venv/bin/python -m pytest tests/test_i18n.py tests/test_bot_city_flow.py tests/test_bot_i18n_flow.py -v
.venv/bin/python -m pytest tests/test_verify_mvp.py -v
.venv/bin/python scripts/verify_mvp.py i18n
.venv/bin/python -m pytest tests/ -v
```

Expected:

- Translation dictionaries exist for `ru` and `en` and expose the same keys.
- Unsupported language codes fall back to English.
- User language persists in `users.language_code`.
- `/start` uses Telegram language metadata.
- `/language` switches the stored user language.
- City geocoding receives the stored user language.
- Russian and English city-flow copy both render expected user-facing text.

Actual:

- `scripts/verify_mvp.py i18n` matched all expected-vs-actual checks.
- Targeted i18n/Telegram tests passed.
- Alembic applied `002 -> 003`.
- Full suite passed: 56 tests in 5.26s.
