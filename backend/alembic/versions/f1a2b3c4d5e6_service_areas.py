"""service areas: mp_service_area managed serviceability catalogue

Revision ID: f1a2b3c4d5e6
Revises: d4f7b1a9c2e8
Create Date: 2026-11-27 00:00:00.000000

Additive only: creates the ``mp_service_area`` table. No existing table is
altered and no data is migrated, so this is safe to apply independently. It does
NOT change dispatch or booking behaviour — the catalogue is informational/managed
until serviceability gating is turned on as a separate, decided change.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

import app.db.types  # custom column types (e.g. GUID) used in migrations
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "d4f7b1a9c2e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mp_service_area",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=False),
        sa.Column("center_lng", sa.Float(), nullable=False),
        sa.Column("radius_km", sa.Float(), nullable=False),
        sa.Column("pincodes", sa.JSON(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", app.db.types.GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("radius_km > 0", name="ck_service_area_radius_pos"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mp_service_area_active", "mp_service_area", ["active"])


def downgrade() -> None:
    op.drop_index("ix_mp_service_area_active", table_name="mp_service_area")
    op.drop_table("mp_service_area")
