"""FastAPI application entry point with Telegram bot integration."""
import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from src.api.health import router as health_router
from src.api.routes import router as api_router
from src.api.solar_system import router as solar_system_router
from src.config import settings

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

logger = structlog.get_logger()

_bot = None
_dp = None
_polling_task = None


def should_delete_webhook_on_shutdown() -> bool:
    return settings.BOT_MODE == "webhook" and settings.DELETE_WEBHOOK_ON_SHUTDOWN


def _init_bot():
    global _bot, _dp
    if _bot is None:
        from src.bot.main import create_bot, create_dispatcher
        _bot = create_bot()
        _dp = create_dispatcher()
    return _bot, _dp


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _polling_task

    if settings.BOT_TOKEN != "changeme":
        bot, dp = _init_bot()

        if settings.BOT_MODE == "polling":
            logger.info("bot.starting_polling")
            _polling_task = asyncio.create_task(dp.start_polling(bot))
        else:
            webhook_url = f"{settings.WEBHOOK_BASE_URL}/bot/webhook"
            await bot.set_webhook(
                url=webhook_url,
                secret_token=settings.WEBHOOK_SECRET,
            )
            logger.info("bot.webhook_set", url=webhook_url)
    else:
        logger.warning("bot.skipped", reason="BOT_TOKEN not set")

    yield

    if _bot:
        if _polling_task and not _polling_task.done():
            await _dp.stop_polling()
            _polling_task.cancel()
        if should_delete_webhook_on_shutdown():
            await _bot.delete_webhook()
        await _bot.session.close()


app = FastAPI(title="Astro Bot API", version="0.1.0", lifespan=lifespan)

app.include_router(health_router)
app.include_router(api_router)

if settings.ENABLE_SOLAR_SYSTEM_API:
    app.include_router(solar_system_router)

# Serve frontend static files (must be last — catch-all)
if settings.ENABLE_WEB_UI and FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


@app.post("/bot/webhook")
async def bot_webhook(request: Request) -> dict:
    from aiogram.types import Update
    from src.bot.webhook import verify_telegram_secret

    await verify_telegram_secret(request)
    bot, dp = _init_bot()
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}
