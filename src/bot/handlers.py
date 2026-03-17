"""Telegram bot command handlers."""
from datetime import datetime, timedelta, timezone

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models import (
    AstronomicalEvent,
    EventClass,
    EventVisibilityCache,
    Location,
    User,
)
from src.core.services.users import (
    get_or_create_user,
    get_user_by_telegram_id,
    set_user_location,
    update_notification_preferences,
)

router = Router()

EVENT_TYPE_EMOJI = {
    "solar_eclipse": "\u2600\ufe0f",
    "lunar_eclipse": "\ud83c\udf11",
    "meteor_peak": "\u2604\ufe0f",
    "supermoon": "\ud83c\udf15",
}


@router.message(Command("start"))
async def cmd_start(message: Message, session: AsyncSession) -> None:
    await get_or_create_user(session, message.from_user.id)

    kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Send location", request_location=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await message.answer(
        "Welcome to AstroBot!\n\n"
        "I'll notify you about astronomical events visible from your location.\n\n"
        "Please share your location or send me a city name.",
        reply_markup=kb,
    )


@router.message(F.location)
async def handle_location(message: Message, session: AsyncSession) -> None:
    lat = message.location.latitude
    lon = message.location.longitude

    # Simple timezone estimation from longitude
    tz_offset = round(lon / 15)
    tz_name = f"Etc/GMT{-tz_offset:+d}" if tz_offset != 0 else "UTC"

    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz_name)
    except (KeyError, Exception):
        tz_name = "UTC"

    await set_user_location(session, message.from_user.id, lat, lon, tz_name)
    await message.answer(
        f"Location saved: {lat:.2f}, {lon:.2f}\n"
        f"Timezone: {tz_name}\n\n"
        "Use /today to see today's events or /settings to configure notifications.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Command("today"))
async def cmd_today(message: Message, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, message.from_user.id)

    if user is None or user.location_id is None:
        await message.answer("Please set your location first with /start")
        return

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Also show events in next 7 days if nothing today
    week_end = now + timedelta(days=7)

    stmt = (
        select(EventVisibilityCache, AstronomicalEvent)
        .join(AstronomicalEvent)
        .where(
            EventVisibilityCache.location_id == user.location_id,
            EventVisibilityCache.is_visible.is_(True),
            AstronomicalEvent.global_start_time_utc.between(today_start, week_end),
        )
        .order_by(AstronomicalEvent.global_start_time_utc)
    )
    result = await session.execute(stmt)
    rows = result.all()

    if not rows:
        await message.answer("No visible astronomical events in the next 7 days.")
        return

    lines = ["Upcoming astronomical events:\n"]
    for vis, event in rows:
        emoji = EVENT_TYPE_EMOJI.get(event.type, "\u2728")
        event_name = event.type.replace("_", " ").title()
        time_str = event.global_start_time_utc.strftime("%b %d, %H:%M UTC")
        best_time = ""
        if vis.local_best_time:
            best_time = f" (best viewing: {vis.local_best_time.strftime('%H:%M UTC')})"

        params_info = ""
        if event.parameters:
            if "shower_name" in event.parameters:
                params_info = f" - {event.parameters['shower_name']}"
            elif "eclipse_type" in event.parameters:
                params_info = f" - {event.parameters['eclipse_type']}"

        lines.append(f"{emoji} {event_name}{params_info}")
        lines.append(f"   {time_str}{best_time}")
        lines.append("")

    await message.answer("\n".join(lines))


@router.message(Command("settings"))
async def cmd_settings(message: Message, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, message.from_user.id)

    if user is None:
        await message.answer("Please register first with /start")
        return

    rare_status = "ON" if user.notify_rare else "OFF"
    regular_status = "ON" if user.notify_regular else "OFF"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=f"Rare events: {rare_status}",
                callback_data="toggle_rare",
            ),
        ],
        [
            InlineKeyboardButton(
                text=f"Regular events: {regular_status}",
                callback_data="toggle_regular",
            ),
        ],
        [
            InlineKeyboardButton(
                text="Set alert time: 12h before",
                callback_data="ahead_12",
            ),
            InlineKeyboardButton(
                text="24h before",
                callback_data="ahead_24",
            ),
            InlineKeyboardButton(
                text="48h before",
                callback_data="ahead_48",
            ),
        ],
    ])

    await message.answer(
        "Notification settings:\n\n"
        f"Rare events (eclipses): {rare_status}\n"
        f"Regular events (meteors, supermoons): {regular_status}\n",
        reply_markup=kb,
    )


@router.callback_query(F.data == "toggle_rare")
async def toggle_rare(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        user.notify_rare = not user.notify_rare
        await session.commit()
        await callback.answer(f"Rare events: {'ON' if user.notify_rare else 'OFF'}")
        await cmd_settings(callback.message, session)


@router.callback_query(F.data == "toggle_regular")
async def toggle_regular(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        user.notify_regular = not user.notify_regular
        await session.commit()
        await callback.answer(f"Regular events: {'ON' if user.notify_regular else 'OFF'}")
        await cmd_settings(callback.message, session)


@router.callback_query(F.data.startswith("ahead_"))
async def set_ahead_hours(callback: CallbackQuery, session: AsyncSession) -> None:
    hours = int(callback.data.split("_")[1])
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        for event_class in EventClass:
            await update_notification_preferences(session, user.id, event_class, hours)
        await callback.answer(f"Alert time set to {hours}h before event")
