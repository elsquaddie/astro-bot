"""Aiogram bot dispatcher setup."""
from aiogram import Bot, Dispatcher

from src.bot.handlers import router
from src.bot.middlewares import DbSessionMiddleware
from src.config import settings


def create_bot() -> Bot:
    return Bot(token=settings.BOT_TOKEN)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.message.middleware(DbSessionMiddleware())
    dp.callback_query.middleware(DbSessionMiddleware())
    dp.include_router(router)
    return dp
