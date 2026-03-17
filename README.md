# AstroBot — Astronomical Event Tracker

Telegram-бот + REST API + 3D веб-интерфейс для отслеживания астрономических событий.

## Локальный запуск

### Требования
- Python 3.11+
- Docker (для PostgreSQL)

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
# Отредактируй .env — минимально нужен DATABASE_URL (уже заполнен)
# Для бота — впиши BOT_TOKEN от @BotFather
```

### 4. База данных
```bash
alembic upgrade head          # создать таблицы
python -m src.data.seed_db    # загрузить тестовые события
```

### 5. Запуск (3 терминала)

**Терминал 1 — API + веб-интерфейс + бот:**
```bash
uvicorn src.main:app --port 8001 --reload
```

**Терминал 2 — фоновый воркер:**
```bash
python -m src.worker
```

### 6. Проверка
- Веб-интерфейс: http://localhost:8001/
- Health: http://localhost:8001/health
- API: `curl -H "X-API-Key: dev-api-key" "http://localhost:8001/api/events/today?lat=55.75&lon=37.61"`
- Тесты: `pytest tests/ -v`

---

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
# Заполнить .env: DATABASE_URL, BOT_TOKEN, API_SECRET_KEY, WEBHOOK_SECRET, WEBHOOK_BASE_URL
alembic upgrade head
python -m src.data.seed_db
```

### systemd (API)
```ini
# /etc/systemd/system/astro-api.service
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

### systemd (Worker)
```ini
# /etc/systemd/system/astro-worker.service
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

---

## Telegram-бот

### Настройка
1. Создай бота через [@BotFather](https://t.me/BotFather): `/newbot`
2. Скопируй токен в `.env` → `BOT_TOKEN=...`

### Режим polling (локалка)
```
BOT_MODE=polling
```
Бот работает без HTTPS — удобно для разработки.

### Режим webhook (прод)
```
BOT_MODE=webhook
WEBHOOK_BASE_URL=https://astro.example.com
WEBHOOK_SECRET=random-secret-string
```
Требует HTTPS. Webhook регистрируется автоматически при старте.

### Команды бота
- `/start` — регистрация, отправка геолокации
- `/today` — астрособытия на ближайшие 7 дней
- `/settings` — настройка уведомлений

---

## Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://astro:astro_pass@localhost:5432/astro_bot` |
| `BOT_TOKEN` | Telegram bot token | `changeme` |
| `BOT_MODE` | `polling` или `webhook` | `polling` |
| `WEBHOOK_SECRET` | Секрет для webhook | `changeme` |
| `WEBHOOK_BASE_URL` | HTTPS URL сервера | `https://example.com` |
| `API_SECRET_KEY` | Ключ для REST API | `changeme` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |
