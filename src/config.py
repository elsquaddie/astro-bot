from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://astro:astro_pass@localhost:5432/astro_bot"

    # Telegram Bot
    BOT_TOKEN: str = "changeme"
    BOT_MODE: str = "polling"  # polling or webhook
    WEBHOOK_SECRET: str = "changeme"
    WEBHOOK_BASE_URL: str = "https://example.com"
    DELETE_WEBHOOK_ON_SHUTDOWN: bool = False

    # API
    API_SECRET_KEY: str = "changeme"

    # Optional prototype UI/API
    ENABLE_WEB_UI: bool = False
    ENABLE_SOLAR_SYSTEM_API: bool = False

    # External data providers
    GEOCODING_PROVIDER: str = "open-meteo"
    WEATHER_PROVIDER: str = "open-meteo"
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com"
    OPEN_METEO_GEOCODING_BASE_URL: str = "https://geocoding-api.open-meteo.com"

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
