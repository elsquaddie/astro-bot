"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

event_class_enum = postgresql.ENUM("rare", "regular", name="eventclass", create_type=False)
notification_status_enum = postgresql.ENUM(
    "pending", "sending", "sent", "failed", name="notificationstatus", create_type=False
)


def upgrade() -> None:
    # Create enums
    event_class_enum.create(op.get_bind(), checkfirst=True)
    notification_status_enum.create(op.get_bind(), checkfirst=True)

    # locations
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("lat_rounded", sa.Float(), nullable=False),
        sa.Column("lon_rounded", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("lat_rounded", "lon_rounded", name="uq_location_rounded"),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("notify_rare", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notify_regular", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)

    # user_notification_preferences
    op.create_table(
        "user_notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_class", event_class_enum, nullable=False),
        sa.Column("ahead_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "event_class", name="uq_user_event_class"),
    )

    # astronomical_events
    op.create_table(
        "astronomical_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("class_type", event_class_enum, nullable=False),
        sa.Column("global_start_time_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("min_lat", sa.Float(), nullable=True),
        sa.Column("max_lat", sa.Float(), nullable=True),
        sa.Column("min_lon", sa.Float(), nullable=True),
        sa.Column("max_lon", sa.Float(), nullable=True),
        sa.Column("parameters", postgresql.JSONB(), nullable=True),
        sa.Column("seed_version", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_astro_events_start_time", "astronomical_events", ["global_start_time_utc"])

    # event_visibility_cache
    op.create_table(
        "event_visibility_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("astronomical_events.id"), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("local_best_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("location_id", "event_id", name="uq_location_event"),
    )

    # notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("astronomical_events.id"), nullable=False),
        sa.Column("scheduled_send_time_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", notification_status_enum, nullable=False, server_default="pending"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_send_time", "notifications", ["scheduled_send_time_utc"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("event_visibility_cache")
    op.drop_table("astronomical_events")
    op.drop_table("user_notification_preferences")
    op.drop_table("users")
    op.drop_table("locations")
    notification_status_enum.drop(op.get_bind(), checkfirst=True)
    event_class_enum.drop(op.get_bind(), checkfirst=True)
