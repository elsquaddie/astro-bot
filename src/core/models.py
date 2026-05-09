import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EventClass(str, enum.Enum):
    RARE = "rare"
    REGULAR = "regular"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class Location(TimestampMixin, Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("lat_rounded", "lon_rounded", name="uq_location_rounded"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    lat_rounded: Mapped[float] = mapped_column(Float, nullable=False)
    lon_rounded: Mapped[float] = mapped_column(Float, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    admin1: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_location_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="location")
    visibility_cache: Mapped[list["EventVisibilityCache"]] = relationship(back_populates="location")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    notify_rare: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_regular: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    language_code: Mapped[str] = mapped_column(String(8), default="en", nullable=False)

    location: Mapped[Location | None] = relationship(back_populates="users")
    notification_preferences: Mapped[list["UserNotificationPreference"]] = relationship(
        back_populates="user"
    )
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")


class UserNotificationPreference(TimestampMixin, Base):
    __tablename__ = "user_notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "event_class", name="uq_user_event_class"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    event_class: Mapped[EventClass] = mapped_column(
        Enum(EventClass, values_callable=lambda e: [x.value for x in e]), nullable=False
    )
    ahead_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)

    user: Mapped[User] = relationship(back_populates="notification_preferences")


class AstronomicalEvent(TimestampMixin, Base):
    __tablename__ = "astronomical_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    class_type: Mapped[EventClass] = mapped_column(
        Enum(EventClass, values_callable=lambda e: [x.value for x in e]), nullable=False
    )
    global_start_time_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    min_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    parameters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    seed_version: Mapped[str | None] = mapped_column(String(32), nullable=True)

    visibility_cache: Mapped[list["EventVisibilityCache"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(back_populates="event")


class EventVisibilityCache(TimestampMixin, Base):
    __tablename__ = "event_visibility_cache"
    __table_args__ = (
        UniqueConstraint("location_id", "event_id", name="uq_location_event"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("astronomical_events.id"), nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    local_best_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    location: Mapped[Location] = relationship(back_populates="visibility_cache")
    event: Mapped[AstronomicalEvent] = relationship(back_populates="visibility_cache")


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("astronomical_events.id"), nullable=False)
    scheduled_send_time_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, values_callable=lambda e: [x.value for x in e]),
        default=NotificationStatus.PENDING, nullable=False
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="notifications")
    event: Mapped[AstronomicalEvent] = relationship(back_populates="notifications")
