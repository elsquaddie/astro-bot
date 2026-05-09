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

from src.config import settings
from src.bot.i18n import (
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    language_name,
    normalize_language_code,
    t,
)
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
from src.core.services.geocoding import GeocodingCandidate, OpenMeteoGeocoder
from src.core.services.visibility import build_visibility_cache_for_location

router = Router()

EVENT_TYPE_EMOJI = {
    "solar_eclipse": "\u2600\ufe0f",
    "lunar_eclipse": "\ud83c\udf11",
    "meteor_peak": "\u2604\ufe0f",
    "supermoon": "\ud83c\udf15",
}


def _telegram_language_code(message_or_callback: Message | CallbackQuery) -> str:
    from_user = getattr(message_or_callback, "from_user", None)
    return normalize_language_code(getattr(from_user, "language_code", None))


async def _get_existing_user_language(
    session: AsyncSession,
    telegram_id: int,
    fallback_language_code: str | None = None,
) -> str:
    user = await get_user_by_telegram_id(session, telegram_id)
    if user is not None:
        return normalize_language_code(user.language_code)
    return normalize_language_code(fallback_language_code)


def _status_label(enabled: bool, language_code: str) -> str:
    return t(language_code, "status_on" if enabled else "status_off")


def _event_type_label(event_type: str, language_code: str) -> str:
    key = f"event_type_{event_type}"
    try:
        return t(language_code, key)
    except KeyError:
        return t(
            language_code,
            "event_type_unknown",
            event_type=event_type.replace("_", " ").title(),
        )


def format_city_candidates(
    candidates: list[GeocodingCandidate],
    language_code: str = "ru",
) -> str:
    lines = [t(language_code, "city_candidates")]
    for index, candidate in enumerate(candidates, start=1):
        lines.append(f"{index}. {candidate.display_name}")
    return "\n".join(lines)


def format_location_saved_message(
    display_name: str,
    language_code: str = "ru",
) -> str:
    return t(language_code, "location_saved", display_name=display_name)


def format_visibility_pending_message(
    location_name: str,
    language_code: str = "ru",
) -> str:
    return t(language_code, "visibility_pending", location_name=location_name)


def format_no_events_message(
    location_name: str,
    days: int,
    language_code: str = "ru",
) -> str:
    return t(language_code, "no_events", location_name=location_name, days=days)


async def save_city_candidate(
    message: Message,
    session: AsyncSession,
    telegram_id: int,
    candidate: GeocodingCandidate,
    language_code: str = "ru",
) -> None:
    user = await set_user_location(
        session,
        telegram_id,
        candidate.latitude,
        candidate.longitude,
        candidate.timezone,
        display_name=candidate.display_name,
        country_code=candidate.country_code,
        admin1=candidate.admin1,
        source_location_id=candidate.source_location_id,
    )
    if user.location_id is not None:
        await build_visibility_cache_for_location(session, user.location_id, days_ahead=30)
    await message.answer(
        format_location_saved_message(candidate.display_name, language_code=language_code)
    )


@router.message(Command("start"))
async def cmd_start(message: Message, session: AsyncSession) -> None:
    language_code = _telegram_language_code(message)
    user = await get_or_create_user(
        session,
        message.from_user.id,
        language_code=language_code,
    )
    language_code = user.language_code

    kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(language_code, "send_location_button"), request_location=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await message.answer(
        t(language_code, "start"),
        reply_markup=kb,
    )


@router.message(F.location)
async def handle_location(message: Message, session: AsyncSession) -> None:
    language_code = _telegram_language_code(message)
    user = await get_or_create_user(
        session,
        message.from_user.id,
        language_code=language_code,
    )
    language_code = user.language_code
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
        t(
            language_code,
            "coordinates_saved",
            latitude=lat,
            longitude=lon,
            timezone=tz_name,
        ),
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(F.text & ~F.text.startswith("/"))
async def handle_city_text(message: Message, session: AsyncSession) -> None:
    user = await get_or_create_user(
        session,
        message.from_user.id,
        language_code=_telegram_language_code(message),
    )
    language_code = user.language_code
    query = message.text.strip()
    geocoder = OpenMeteoGeocoder(
        base_url=settings.OPEN_METEO_GEOCODING_BASE_URL,
    )
    candidates = await geocoder.search(query, language=language_code, count=5)

    if not candidates:
        await message.answer(t(language_code, "city_not_found"))
        return

    if len(candidates) == 1:
        await save_city_candidate(
            message,
            session,
            message.from_user.id,
            candidates[0],
            language_code=language_code,
        )
        return

    buttons = []
    for candidate in candidates[:5]:
        buttons.append([
            InlineKeyboardButton(
                text=candidate.display_name[:60],
                callback_data=f"city:{candidate.source_location_id}",
            )
        ])

    await message.answer(
        format_city_candidates(candidates[:5], language_code=language_code),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("city:"))
async def select_city(callback: CallbackQuery, session: AsyncSession) -> None:
    language_code = await _get_existing_user_language(
        session,
        callback.from_user.id,
        _telegram_language_code(callback),
    )
    source_location_id = int(callback.data.split(":", 1)[1])
    geocoder = OpenMeteoGeocoder(
        base_url=settings.OPEN_METEO_GEOCODING_BASE_URL,
    )
    candidate = await geocoder.get_by_id(source_location_id, language=language_code)

    if candidate is None:
        await callback.answer(t(language_code, "city_not_found_callback"))
        return

    await save_city_candidate(
        callback.message,
        session,
        callback.from_user.id,
        candidate,
        language_code=language_code,
    )
    await callback.answer(t(language_code, "city_saved_callback"))


@router.message(Command("language"))
async def cmd_language(message: Message, session: AsyncSession) -> None:
    language_code = await _get_existing_user_language(
        session,
        message.from_user.id,
        _telegram_language_code(message),
    )
    buttons = [
        [
            InlineKeyboardButton(
                text=language_name(language, language_code),
                callback_data=f"lang:{language}",
            )
        ]
        for language in sorted(SUPPORTED_LANGUAGES)
    ]
    await message.answer(
        t(language_code, "language_prompt"),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("lang:"))
async def select_language(callback: CallbackQuery, session: AsyncSession) -> None:
    language_code = normalize_language_code(callback.data.split(":", 1)[1])
    await get_or_create_user(
        session,
        callback.from_user.id,
        language_code=language_code,
    )
    await session.commit()
    await callback.answer(t(language_code, "language_updated"))


@router.message(Command("today"))
async def cmd_today(message: Message, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, message.from_user.id)
    language_code = (
        normalize_language_code(user.language_code)
        if user is not None
        else _telegram_language_code(message)
    )

    if user is None or user.location_id is None:
        await message.answer(t(language_code, "set_location_first"))
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
        location = await session.get(Location, user.location_id)
        location_name = (
            location.display_name
            if location and location.display_name
            else t(language_code, "fallback_location_name")
        )

        cache_stmt = (
            select(EventVisibilityCache.id)
            .where(EventVisibilityCache.location_id == user.location_id)
            .limit(1)
        )
        cache_result = await session.execute(cache_stmt)
        has_cache = cache_result.scalar_one_or_none() is not None

        if not has_cache:
            try:
                await build_visibility_cache_for_location(
                    session,
                    user.location_id,
                    days_ahead=30,
                )
            except Exception:
                await message.answer(
                    format_visibility_pending_message(
                        location_name,
                        language_code=language_code,
                    )
                )
                return

            result = await session.execute(stmt)
            rows = result.all()

    if not rows:
        location = await session.get(Location, user.location_id)
        location_name = (
            location.display_name
            if location and location.display_name
            else t(language_code, "fallback_location_name")
        )
        await message.answer(
            format_no_events_message(location_name, days=7, language_code=language_code)
        )
        return

    lines = [f"{t(language_code, 'today_header')}\n"]
    for vis, event in rows:
        emoji = EVENT_TYPE_EMOJI.get(event.type, "\u2728")
        event_name = _event_type_label(event.type, language_code)
        time_str = event.global_start_time_utc.strftime("%b %d, %H:%M UTC")
        best_time = ""
        if vis.local_best_time:
            best_time = (
                " ("
                + t(
                    language_code,
                    "best_viewing",
                    time=vis.local_best_time.strftime("%H:%M UTC"),
                )
                + ")"
            )

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
    language_code = (
        normalize_language_code(user.language_code)
        if user is not None
        else _telegram_language_code(message)
    )

    if user is None:
        await message.answer(t(language_code, "register_first"))
        return

    rare_status = _status_label(user.notify_rare, language_code)
    regular_status = _status_label(user.notify_regular, language_code)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=t(language_code, "settings_rare_button", status=rare_status),
                callback_data="toggle_rare",
            ),
        ],
        [
            InlineKeyboardButton(
                text=t(language_code, "settings_regular_button", status=regular_status),
                callback_data="toggle_regular",
            ),
        ],
        [
            InlineKeyboardButton(
                text=t(language_code, "settings_alert_12_button"),
                callback_data="ahead_12",
            ),
            InlineKeyboardButton(
                text=t(language_code, "settings_alert_24_button"),
                callback_data="ahead_24",
            ),
            InlineKeyboardButton(
                text=t(language_code, "settings_alert_48_button"),
                callback_data="ahead_48",
            ),
        ],
    ])

    await message.answer(
        t(language_code, "settings_title")
        + "\n\n"
        + t(language_code, "settings_rare_line", status=rare_status)
        + "\n"
        + t(language_code, "settings_regular_line", status=regular_status)
        + "\n",
        reply_markup=kb,
    )


@router.callback_query(F.data == "toggle_rare")
async def toggle_rare(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        language_code = normalize_language_code(user.language_code)
        user.notify_rare = not user.notify_rare
        await session.commit()
        await callback.answer(
            t(
                language_code,
                "toggle_rare_callback",
                status=_status_label(user.notify_rare, language_code),
            )
        )
        await cmd_settings(callback.message, session)


@router.callback_query(F.data == "toggle_regular")
async def toggle_regular(callback: CallbackQuery, session: AsyncSession) -> None:
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        language_code = normalize_language_code(user.language_code)
        user.notify_regular = not user.notify_regular
        await session.commit()
        await callback.answer(
            t(
                language_code,
                "toggle_regular_callback",
                status=_status_label(user.notify_regular, language_code),
            )
        )
        await cmd_settings(callback.message, session)


@router.callback_query(F.data.startswith("ahead_"))
async def set_ahead_hours(callback: CallbackQuery, session: AsyncSession) -> None:
    hours = int(callback.data.split("_")[1])
    user = await get_user_by_telegram_id(session, callback.from_user.id)
    if user:
        language_code = normalize_language_code(user.language_code)
        for event_class in EventClass:
            await update_notification_preferences(session, user.id, event_class, hours)
        await callback.answer(
            t(language_code, "alert_time_callback", hours=hours)
        )
