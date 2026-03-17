"""Idempotent database seeder for astronomical events."""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import async_session
from src.core.models import AstronomicalEvent, EventClass, EventVisibilityCache

logger = structlog.get_logger()

SEEDS_DIR = Path(__file__).parent / "seeds"


def parse_event(raw: dict, version: str) -> dict:
    return {
        "type": raw["type"],
        "class_type": EventClass(raw["class_type"]),
        "global_start_time_utc": datetime.fromisoformat(
            raw["global_start_time_utc"].replace("Z", "+00:00")
        ),
        "min_lat": raw.get("min_lat"),
        "max_lat": raw.get("max_lat"),
        "min_lon": raw.get("min_lon"),
        "max_lon": raw.get("max_lon"),
        "parameters": raw.get("parameters"),
        "seed_version": version,
    }


async def seed_events(session: AsyncSession) -> None:
    seed_file = SEEDS_DIR / "events_v2.json"
    data = json.loads(seed_file.read_text())
    version = data["version"]

    for raw in data["events"]:
        parsed = parse_event(raw, version)

        # Find existing by type + start time (natural key)
        stmt = select(AstronomicalEvent).where(
            AstronomicalEvent.type == parsed["type"],
            AstronomicalEvent.global_start_time_utc == parsed["global_start_time_utc"],
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is None:
            event = AstronomicalEvent(**parsed)
            session.add(event)
            logger.info("seed.event.created", type=parsed["type"],
                        time=str(parsed["global_start_time_utc"]))
        elif existing.seed_version != version:
            for key, value in parsed.items():
                setattr(existing, key, value)
            # Invalidate visibility cache for updated events
            await session.execute(
                delete(EventVisibilityCache).where(
                    EventVisibilityCache.event_id == existing.id
                )
            )
            logger.info("seed.event.updated", type=parsed["type"],
                        old_version=existing.seed_version, new_version=version)
        else:
            logger.info("seed.event.skipped", type=parsed["type"],
                        reason="already up to date")

    await session.commit()


async def main() -> None:
    structlog.configure(
        processors=[
            structlog.dev.ConsoleRenderer(),
        ],
    )
    async with async_session() as session:
        await seed_events(session)
    logger.info("seed.complete")


if __name__ == "__main__":
    asyncio.run(main())
