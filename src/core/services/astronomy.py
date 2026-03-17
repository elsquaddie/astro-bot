"""Astronomical visibility calculations using Skyfield."""
import asyncio
from datetime import datetime, timedelta, timezone

from skyfield.api import load, wgs84

from src.core.services.skyfield_core import get_ephemeris

_ts = load.timescale()


def _compute_moon_altitude(lat: float, lon: float, dt: datetime) -> float:
    """Compute Moon altitude in degrees at given location and time."""
    planets = get_ephemeris()
    t = _ts.from_datetime(dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt)

    earth = planets["earth"]
    moon = planets["moon"]

    observer = earth + wgs84.latlon(lat, lon)
    astrometric = observer.at(t).observe(moon)
    alt, az, distance = astrometric.apparent().altaz()
    return alt.degrees


def _compute_sun_altitude(lat: float, lon: float, dt: datetime) -> float:
    """Compute Sun altitude in degrees at given location and time."""
    planets = get_ephemeris()
    t = _ts.from_datetime(dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt)

    earth = planets["earth"]
    sun = planets["sun"]

    observer = earth + wgs84.latlon(lat, lon)
    astrometric = observer.at(t).observe(sun)
    alt, az, distance = astrometric.apparent().altaz()
    return alt.degrees


def _is_night(lat: float, lon: float, dt: datetime) -> bool:
    """Check if it's dark enough for observations (Sun below -6 degrees)."""
    return _compute_sun_altitude(lat, lon, dt) < -6.0


def compute_visibility(
    event_type: str,
    lat: float,
    lon: float,
    event_time_utc: datetime,
    parameters: dict | None = None,
) -> tuple[bool, datetime | None]:
    """
    Compute if an astronomical event is visible from a given location.

    Returns (is_visible, local_best_time).
    """
    params = parameters or {}

    if event_type == "solar_eclipse":
        # Solar eclipse: Sun must be above horizon at event time
        sun_alt = _compute_sun_altitude(lat, lon, event_time_utc)
        if sun_alt > 5.0:
            return True, event_time_utc
        return False, None

    elif event_type == "lunar_eclipse":
        # Lunar eclipse: Moon must be above horizon and Sun below
        moon_alt = _compute_moon_altitude(lat, lon, event_time_utc)
        is_night = _is_night(lat, lon, event_time_utc)
        if moon_alt > 5.0 and is_night:
            return True, event_time_utc
        return False, None

    elif event_type == "meteor_peak":
        # Meteor shower: need dark sky, check around peak time +-2h
        for offset_h in range(-2, 3):
            check_time = event_time_utc + timedelta(hours=offset_h)
            if _is_night(lat, lon, check_time):
                return True, check_time
        return False, None

    elif event_type == "supermoon":
        # Supermoon: Moon must be above horizon, ideally at night
        # Check from event time through next 12 hours
        for offset_h in range(0, 13):
            check_time = event_time_utc + timedelta(hours=offset_h)
            moon_alt = _compute_moon_altitude(lat, lon, check_time)
            if moon_alt > 10.0 and _is_night(lat, lon, check_time):
                return True, check_time
        return False, None

    # Unknown event type: assume visible
    return True, event_time_utc


async def compute_visibility_async(
    event_type: str,
    lat: float,
    lon: float,
    event_time_utc: datetime,
    parameters: dict | None = None,
) -> tuple[bool, datetime | None]:
    """Async wrapper for compute_visibility using asyncio.to_thread."""
    return await asyncio.to_thread(
        compute_visibility, event_type, lat, lon, event_time_utc, parameters
    )
