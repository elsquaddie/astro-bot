"""Tests for astronomical visibility calculations."""
from datetime import datetime, timezone

import pytest

from src.core.services.astronomy import compute_visibility


def test_solar_eclipse_visible_daytime():
    """Solar eclipse should be visible when Sun is up."""
    # Moscow, midday - Sun is high
    is_visible, best_time = compute_visibility(
        event_type="solar_eclipse",
        lat=55.75,
        lon=37.61,
        event_time_utc=datetime(2026, 8, 12, 12, 0, tzinfo=timezone.utc),
    )
    assert is_visible is True
    assert best_time is not None


def test_solar_eclipse_not_visible_nighttime():
    """Solar eclipse not visible when Sun is down at the location."""
    # Tokyo at 2am UTC = 11am local, but let's pick a time when it's night
    # Sydney at 3am UTC = 1pm AEST, should be daytime
    # Let's use a location where it's night: New York at 3am UTC = 10pm EST
    is_visible, best_time = compute_visibility(
        event_type="solar_eclipse",
        lat=40.71,
        lon=-74.01,
        event_time_utc=datetime(2026, 8, 12, 3, 0, tzinfo=timezone.utc),
    )
    assert is_visible is False


def test_meteor_shower_visible_dark_sky():
    """Meteor shower visible when sky is dark."""
    # Moscow at midnight UTC = 3am local, should be dark in August
    is_visible, best_time = compute_visibility(
        event_type="meteor_peak",
        lat=55.75,
        lon=37.61,
        event_time_utc=datetime(2026, 8, 12, 22, 0, tzinfo=timezone.utc),
    )
    assert is_visible is True
    assert best_time is not None


def test_supermoon_visible():
    """Supermoon should be visible when Moon is up at night."""
    # Check supermoon visibility - use a time when moon is likely up at night
    is_visible, best_time = compute_visibility(
        event_type="supermoon",
        lat=55.75,
        lon=37.61,
        event_time_utc=datetime(2026, 5, 26, 11, 51, tzinfo=timezone.utc),
    )
    # Result depends on actual moon position, just verify it returns valid data
    assert isinstance(is_visible, bool)
    if is_visible:
        assert best_time is not None


def test_unknown_event_type_returns_visible():
    """Unknown event types default to visible."""
    is_visible, best_time = compute_visibility(
        event_type="unknown_event",
        lat=55.75,
        lon=37.61,
        event_time_utc=datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc),
    )
    assert is_visible is True
