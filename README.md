# AstroBot — Telegram-first Astronomical Event Assistant

## Новый интерфейс «Смотри на небо.»

В `web/` добавлено отдельное мобильное веб-приложение: ближайшее наблюдаемое событие, выбор города, локальный расчёт на 365 дней, сохранённые планы и экспорт напоминаний в календарь. Запускается без PostgreSQL и токена бота. Команды, архитектура и ограничения — в [web/README.md](web/README.md). Существующий Python backend в этой итерации не менялся; связь нового интерфейса с Telegram ещё не подключена.

AstroBot — Telegram-first бот для поиска астрономических событий, видимых из города или текущей локации пользователя. Цель продукта: заранее предупредить о затмениях, метеорных потоках, суперлуниях и других событиях, которые стоит увидеть невооруженным глазом или в телескоп.

Текущий MVP делает акцент на Telegram:

- выбор локации через Telegram location или название города;
- расчет видимости событий для конкретной локации;
- on-demand пересчет visibility cache для новых локаций;
- базовые настройки уведомлений;
- русский и английский интерфейс Telegram-бота;
- подготовленный слой для оценки условий наблюдения через погоду.

3D Solar System frontend и визуальный календарь сохранены как прототип и выключены по умолчанию.

## Локальный запуск

### Требования

- Python 3.11+
- Docker для PostgreSQL

### 1. PostgreSQL

```bash
docker compose up -d
```

### 2. Python-окружение

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 3. Конфигурация

```bash
cp .env.example .env
```

По умолчанию `BOT_TOKEN=changeme`, поэтому Telegram-бот не стартует. Это удобно для API-only локальных проверок.

Для Telegram polling или webhook впиши реальный токен от BotFather:

```env
BOT_TOKEN=123456:real-token
```

### 4. База данных

```bash
alembic upgrade head
python -m src.data.seed_db
```

### 5. Запуск

API и Telegram polling/webhook integration:

```bash
uvicorn src.main:app --port 8001 --reload
```

Worker для cache/notifications:

```bash
python -m src.worker
```

### 6. Проверка

```bash
curl http://localhost:8001/health
curl http://localhost:8001/ready
curl -H "X-API-Key: changeme" "http://localhost:8001/api/events/today?lat=55.75&lon=37.61"
pytest tests/ -v
python scripts/verify_mvp.py all
```

## Telegram-бот

### Команды

- `/start` — регистрация и выбор локации.
- `/today` — ближайшие видимые события для выбранной локации.
- `/settings` — настройки уведомлений.
- `/language` — выбор языка: русский или английский.

Язык берется из Telegram `language_code` при `/start`, но пользователь может поменять его вручную через `/language`.

### Выбор города

Пользователь может отправить Telegram location или написать город текстом:

- `Самара`
- `Abu Dhabi`
- `New York`
- `Monte Carlo`

Геокодинг выполняется через Open-Meteo Geocoding API. Если найдено несколько вариантов, бот должен предложить выбор кнопками.

### Visibility cache

Visibility cache больше не должен выглядеть как "событий нет". Если пользователь выбрал новую локацию и cache еще не готов, бот запускает расчет для этой локации on demand и только после этого отвечает на `/today`.

## Weather-aware Conditions

Для условий наблюдения предусмотрен слой Open-Meteo Weather Forecast API:

- cloud cover;
- precipitation probability;
- visibility;
- итоговая оценка `excellent`, `ok`, `poor`, `unknown`.

Прогноз погоды не должен блокировать астрономическое уведомление. Если weather API недоступен, событие все равно отправляется, но без погодной оценки.

## Optional Prototype UI

Старый 3D Solar System frontend и yearly visual calendar выключены по умолчанию.

Чтобы включить их локально:

```env
ENABLE_WEB_UI=true
ENABLE_SOLAR_SYSTEM_API=true
```

После этого:

- frontend доступен на `http://localhost:8001/`;
- Solar System API доступен на `/api/solar-system`.

## Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://astro:astro_pass@localhost:5432/astro_bot` |
| `BOT_TOKEN` | Telegram bot token. `changeme` отключает старт бота | `changeme` |
| `BOT_MODE` | `polling` или `webhook` | `polling` |
| `WEBHOOK_SECRET` | Секрет для Telegram webhook | `changeme` |
| `WEBHOOK_BASE_URL` | HTTPS URL сервера для webhook | `https://example.com` |
| `API_SECRET_KEY` | Ключ для защищенных REST endpoints | `changeme` |
| `ENABLE_WEB_UI` | Включает prototype frontend | `false` |
| `ENABLE_SOLAR_SYSTEM_API` | Включает prototype Solar System API | `false` |
| `GEOCODING_PROVIDER` | Провайдер геокодинга | `open-meteo` |
| `WEATHER_PROVIDER` | Провайдер погоды | `open-meteo` |
| `OPEN_METEO_BASE_URL` | Base URL Forecast API | `https://api.open-meteo.com` |
| `OPEN_METEO_GEOCODING_BASE_URL` | Base URL Geocoding API | `https://geocoding-api.open-meteo.com` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |

## Деплой на сервер

### PostgreSQL

```bash
sudo apt install postgresql
sudo -u postgres createuser astro -P
sudo -u postgres createdb astro_bot -O astro
```

### Приложение

```bash
git clone <repo> /opt/astro-bot
cd /opt/astro-bot
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
python -m src.data.seed_db
```

Заполни `.env`: `DATABASE_URL`, `BOT_TOKEN`, `API_SECRET_KEY`, `WEBHOOK_SECRET`, `WEBHOOK_BASE_URL`.

### systemd API

```ini
[Unit]
Description=AstroBot API
After=postgresql.service

[Service]
WorkingDirectory=/opt/astro-bot
ExecStart=/opt/astro-bot/.venv/bin/uvicorn src.main:app --host 127.0.0.1 --port 8001
EnvironmentFile=/opt/astro-bot/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

### systemd Worker

```ini
[Unit]
Description=AstroBot Worker
After=postgresql.service

[Service]
WorkingDirectory=/opt/astro-bot
ExecStart=/opt/astro-bot/.venv/bin/python -m src.worker
EnvironmentFile=/opt/astro-bot/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name astro.example.com;

    ssl_certificate /etc/letsencrypt/live/astro.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/astro.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo systemctl enable --now astro-api astro-worker
```

## Product Docs

- `docs/product/telegram-first-mvp-features.md` — feature definition and product framing.
- `docs/superpowers/plans/2026-05-09-telegram-first-mvp.md` — implementation plan.
- `docs/product/verification-log.md` — expected vs actual verification log.
