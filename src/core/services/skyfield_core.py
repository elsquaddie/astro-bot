"""Singleton loader for Skyfield ephemeris data."""
import threading
from pathlib import Path

from skyfield.api import Loader

_lock = threading.Lock()
_planets = None

DATA_DIR = Path(__file__).parent.parent.parent.parent  # project root


def get_ephemeris():
    """Load de421.bsp once and return the planets object."""
    global _planets
    if _planets is None:
        with _lock:
            if _planets is None:
                load = Loader(str(DATA_DIR))
                _planets = load("de421.bsp")
    return _planets
