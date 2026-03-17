"""Compute real 3D positions of solar system bodies using Skyfield."""
import asyncio
from datetime import datetime, timedelta, timezone

from skyfield.api import load

from src.core.services.skyfield_core import get_ephemeris

_ts = load.timescale()


def _body_heliocentric(body, sun, t) -> dict:
    """Get heliocentric position of a body in AU (simple vector subtraction)."""
    body_pos = body.at(t).position.au
    sun_pos = sun.at(t).position.au
    return {
        "x": float(body_pos[0] - sun_pos[0]),
        "y": float(body_pos[1] - sun_pos[1]),
        "z": float(body_pos[2] - sun_pos[2]),
    }


# Planets available in de421.bsp
_PLANET_KEYS = {
    "mercury": "mercury barycenter",
    "venus": "venus barycenter",
    "mars": "mars barycenter",
    "jupiter": "jupiter barycenter",
    "saturn": "saturn barycenter",
}


def _get_body_positions(dt: datetime) -> dict:
    """
    Get heliocentric positions of solar system bodies in AU.
    Sun is at origin. Returns dict with x,y,z for each body.
    """
    planets = get_ephemeris()
    t = _ts.from_datetime(dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt)

    sun = planets["sun"]
    earth = planets["earth"]
    moon = planets["moon"]

    # Earth and Moon positions (heliocentric)
    earth_xyz = _body_heliocentric(earth, sun, t)
    moon_xyz = _body_heliocentric(moon, sun, t)

    result = {
        "sun": {"x": 0.0, "y": 0.0, "z": 0.0},
        "earth": earth_xyz,
        "moon": moon_xyz,
    }

    # Add other planets
    for name, key in _PLANET_KEYS.items():
        body = planets[key]
        result[name] = _body_heliocentric(body, sun, t)

    return result


async def get_body_positions_async(dt: datetime) -> dict:
    """Async wrapper for body positions calculation."""
    return await asyncio.to_thread(_get_body_positions, dt)
