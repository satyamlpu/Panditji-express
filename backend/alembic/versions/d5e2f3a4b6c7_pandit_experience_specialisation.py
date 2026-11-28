"""pandit experience_years + specialisation (discovery enrichment)

Revision ID: d5e2f3a4b6c7
Revises: c4d1e2f3a5b6
Create Date: 2026-11-22 12:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d5e2f3a4b6c7"
down_revision: str | None = "c4d1e2f3a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mp_pandit", sa.Column("experience_years", sa.Integer(), nullable=True)
    )
    op.add_column(
        "mp_pandit", sa.Column("specialisation", sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("mp_pandit", "specialisation")
    op.drop_column("mp_pandit", "experience_years")
