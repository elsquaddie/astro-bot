"""Add city metadata to locations

Revision ID: 002
Revises: 001
Create Date: 2026-05-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("display_name", sa.String(255), nullable=True))
    op.add_column("locations", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("locations", sa.Column("admin1", sa.String(128), nullable=True))
    op.add_column("locations", sa.Column("source_location_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("locations", "source_location_id")
    op.drop_column("locations", "admin1")
    op.drop_column("locations", "country_code")
    op.drop_column("locations", "display_name")
