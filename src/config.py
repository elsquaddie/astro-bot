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

    # API
    API_SECRET_KEY: str = "changeme"

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
