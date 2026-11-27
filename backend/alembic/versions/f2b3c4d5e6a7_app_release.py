"""app_release table (mobile app releases for the website /download page)

Revision ID: f2b3c4d5e6a7
Revises: e1a2b3c4d5f6
Create Date: 2026-11-20 12:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.base import GUID

revision: str = "f2b3c4d5e6a7"
down_revision: str | None = "e1a2b3c4d5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_release",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("app_type", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("channel", sa.String(), nullable=False, server_default="beta"),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("build_number", sa.Integer(), nullable=True),
        sa.Column("download_url", sa.String(), nullable=True),
        sa.Column("checksum_sha256", sa.String(), nullable=True),
        sa.Column("release_notes", sa.Text(), nullable=True),
        sa.Column("min_supported_version", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_app_release_app_type", "app_release", ["app_type"])


def downgrade() -> None:
    op.drop_index("ix_app_release_app_type", table_name="app_release")
    op.drop_table("app_release")
