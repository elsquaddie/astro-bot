"""Background worker with APScheduler jobs."""
import asyncio
import signal

import structlog
from apscheduler import AsyncScheduler
from apscheduler.triggers.interval import IntervalTrigger

from aiogram import Bot
from sqlalchemy import select

from src.config import settings
from src.core.database import async_session
from src.core.models import AstronomicalEvent, User
from src.core.services.notifications import (
    get_pending_notifications,
    mark_failed,
    mark_sending,
    mark_sent,
    plan_notifications,
)
from src.core.services.visibility import build_visibility_cache

logger = structlog.get_logger()

# Rate-limit semaphore for Telegram API (~25 msg/sec)
_send_semaphore = asyncio.Semaphore(25)


async def job_cache_builder() -> None:
    """Daily job: compute visibility for all events x locations."""
    logger.info("job.cache_builder.start")
    try:
        async with async_session() as session:
            await build_visibility_cache(session)
        logger.info("job.cache_builder.done")
    except Exception:
        logger.exception("job.cache_builder.error")


async def job_notification_planner() -> None:
    """Hourly job: create pending notifications."""
    logger.info("job.notification_planner.start")
    try:
        async with async_session() as session:
            count = await plan_notifications(session)
        logger.info("job.notification_planner.done", created=count)
    except Exception:
        logger.exception("job.notification_planner.error")


_bot: Bot | None = None


def _get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(token=settings.BOT_TOKEN)
    return _bot


async def _send_one(notification_id: int, user_telegram_id: int, message: str) -> None:
    """Send a single notification with rate limiting."""
    async with _send_semaphore:
        if settings.BOT_TOKEN != "changeme":
            bot = _get_bot()
            await bot.send_message(chat_id=user_telegram_id, text=message)
        logger.info(
            "notification.send",
            notification_id=notification_id,
            telegram_id=user_telegram_id,
        )


async def job_sender() -> None:
    """Minutely job: send pending notifications."""
    logger.info("job.sender.start")
    try:
        async with async_session() as session:
            notifications = await get_pending_notifications(session)

            for notification in notifications:
                await mark_sending(session, notification.id)

                try:
                    # Load user and event for message
                    user = (await session.execute(
                        select(User).where(User.id == notification.user_id)
                    )).scalar_one()
                    event = (await session.execute(
                        select(AstronomicalEvent).where(AstronomicalEvent.id == notification.event_id)
                    )).scalar_one()

                    event_name = event.type.replace("_", " ").title()
                    time_str = event.global_start_time_utc.strftime("%b %d, %H:%M UTC")
                    message = f"Upcoming: {event_name} on {time_str}!"

                    if event.parameters:
                        if "shower_name" in event.parameters:
                            message += f"\n{event.parameters['shower_name']}"
                        if "eclipse_type" in event.parameters:
                            message += f"\nType: {event.parameters['eclipse_type']}"

                    await _send_one(notification.id, user.telegram_id, message)
                    await mark_sent(session, notification.id)
                except Exception as e:
                    await mark_failed(session, notification.id, str(e))

        logger.info("job.sender.done")
    except Exception:
        logger.exception("job.sender.error")


async def main() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
    )

    logger.info("worker.starting")

    # Run cache builder immediately on startup
    await job_cache_builder()

    async with AsyncScheduler() as scheduler:
        # Daily: rebuild visibility cache
        await scheduler.add_schedule(
            job_cache_builder,
            IntervalTrigger(hours=24),
            id="cache_builder",
        )

        # Hourly: plan notifications
        await scheduler.add_schedule(
            job_notification_planner,
            IntervalTrigger(hours=1),
            id="notification_planner",
        )

        # Minutely: send notifications
        await scheduler.add_schedule(
            job_sender,
            IntervalTrigger(minutes=1),
            id="sender",
        )

        logger.info("worker.started", jobs=["cache_builder", "notification_planner", "sender"])

        # Wait for shutdown signal
        stop_event = asyncio.Event()

        def _signal_handler():
            logger.info("worker.shutdown_requested")
            stop_event.set()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, _signal_handler)

        await stop_event.wait()
        logger.info("worker.stopped")


if __name__ == "__main__":
    asyncio.run(main())
