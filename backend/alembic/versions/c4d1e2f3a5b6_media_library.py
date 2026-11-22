"""media_asset table (public Media Library for website images)

Revision ID: c4d1e2f3a5b6
Revises: b8d0e1f2a3c4
Create Date: 2026-11-22 10:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.base import GUID

revision: str = "c4d1e2f3a5b6"
down_revision: str | None = "b8d0e1f2a3c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "media_asset",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("alt_text", sa.Text(), nullable=True),
        sa.Column("uploaded_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("storage_key", name="uq_media_asset_storage_key"),
    )
    op.create_index(
        "ix_media_asset_created_at", "media_asset", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_media_asset_created_at", table_name="media_asset")
    op.drop_table("media_asset")
