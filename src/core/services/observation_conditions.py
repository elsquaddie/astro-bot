"""Observation condition scoring for sky events."""
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class ObservationCondition(StrEnum):
    EXCELLENT = "excellent"
    OK = "ok"
    POOR = "poor"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class ObservationConditionResult:
    label: ObservationCondition
    summary: str


def score_observation_conditions(
    *,
    cloud_cover: int | None,
    precipitation_probability: int | None,
    visibility_m: int | None,
    event_time_utc: datetime,
    forecast_available: bool,
) -> ObservationConditionResult:
    if not forecast_available:
        return ObservationConditionResult(
            label=ObservationCondition.UNKNOWN,
            summary="прогноз погоды пока недоступен для этой даты",
        )

    cloud = cloud_cover if cloud_cover is not None else 100
    rain = precipitation_probability if precipitation_probability is not None else 100
    visibility = visibility_m if visibility_m is not None else 0

    if cloud <= 35 and rain <= 20 and visibility >= 10000:
        label = ObservationCondition.EXCELLENT
        prefix = "условия хорошие"
    elif cloud <= 70 and rain <= 50 and visibility >= 5000:
        label = ObservationCondition.OK
        prefix = "условия средние"
    else:
        label = ObservationCondition.POOR
        prefix = "условия плохие"

    return ObservationConditionResult(
        label=label,
        summary=f"{prefix}: облачность около {cloud}%, вероятность осадков {rain}%",
    )
