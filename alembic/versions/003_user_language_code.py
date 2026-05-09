"""Add language code to users

Revision ID: 003
Revises: 002
Create Date: 2026-05-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "language_code",
            sa.String(8),
            nullable=False,
            server_default="en",
        ),
    )
    op.alter_column("users", "language_code", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "language_code")
