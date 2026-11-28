"""booking.preferred_pandit_id (customer-selected pandit)

Additive nullable FK so a customer can request a specific pandit; dispatch offers
them first and falls back to nearest-first. No data changes.

Revision ID: b8d0e1f2a3c4
Revises: a7c8d9e0f1b2
Create Date: 2026-11-20 14:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.base import GUID

revision: str = "b8d0e1f2a3c4"
down_revision: str | None = "a7c8d9e0f1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mp_booking",
        sa.Column("preferred_pandit_id", GUID(), nullable=True),
    )
    # SQLite can't ALTER-ADD a constraint; the FK is declared on the model so
    # create_all gives dev/test the relationship. On PostgreSQL add the real FK.
    if op.get_bind().dialect.name == "postgresql":
        op.create_foreign_key(
            "fk_booking_preferred_pandit",
            "mp_booking",
            "mp_pandit",
            ["preferred_pandit_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.drop_constraint("fk_booking_preferred_pandit", "mp_booking", type_="foreignkey")
    op.drop_column("mp_booking", "preferred_pandit_id")
