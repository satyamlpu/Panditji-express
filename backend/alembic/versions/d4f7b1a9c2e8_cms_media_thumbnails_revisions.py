"""media library, service/category thumbnails, content revisions

Adds the schema behind centralised thumbnail management and the Website
Management revision history:

* ``media_asset`` — one row per uploaded PUBLIC marketing image (the Media
  Library), with storage keys, dimensions and alt text.
* ``content_revision`` — append-only per-entity content snapshots.
* ``service`` / ``category`` gain nullable thumbnail columns
  (``thumbnail_media_id`` FK → media_asset, denormalised ``thumbnail_url`` /
  ``thumbnail_alt``) and ``service.title_hi``.

Every added column is nullable and every added table is new, so the change is
additive and backward-compatible on both SQLite (dev) and Postgres (prod);
existing rows need no backfill (a null thumbnail falls back to a placeholder).

Revision ID: d4f7b1a9c2e8
Revises: e1a2b3c4d5f6
Create Date: 2026-11-26 12:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import app.db.types  # GUID custom type used below

revision: str = "d4f7b1a9c2e8"
down_revision: str | None = "e1a2b3c4d5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "media_asset",
        sa.Column("id", app.db.types.GUID(), nullable=False),
        sa.Column("storage_backend", sa.String(), nullable=False, server_default="local"),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("original_key", sa.String(), nullable=True),
        sa.Column("thumb_key", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("thumb_url", sa.String(), nullable=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("alt_text", sa.Text(), nullable=True),
        sa.Column("created_by", app.db.types.GUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "content_revision",
        sa.Column("id", app.db.types.GUID(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=True),
        sa.Column("actor_id", app.db.types.GUID(), nullable=True),
        sa.Column("actor_email", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_content_revision_entity_type", "content_revision", ["entity_type"]
    )
    op.create_index(
        "ix_content_revision_entity_id", "content_revision", ["entity_id"]
    )

    # Service thumbnail + Hindi name.
    op.add_column("service", sa.Column("title_hi", sa.String(), nullable=True))
    op.add_column(
        "service",
        sa.Column("thumbnail_media_id", app.db.types.GUID(), nullable=True),
    )
    op.add_column("service", sa.Column("thumbnail_url", sa.String(), nullable=True))
    op.add_column("service", sa.Column("thumbnail_alt", sa.String(), nullable=True))
    op.create_index(
        "ix_service_thumbnail_media_id", "service", ["thumbnail_media_id"]
    )

    # Category thumbnail.
    op.add_column(
        "category",
        sa.Column("thumbnail_media_id", app.db.types.GUID(), nullable=True),
    )
    op.add_column("category", sa.Column("thumbnail_url", sa.String(), nullable=True))
    op.add_column("category", sa.Column("thumbnail_alt", sa.String(), nullable=True))
    op.create_index(
        "ix_category_thumbnail_media_id", "category", ["thumbnail_media_id"]
    )

    # Foreign keys to media_asset (named so they are reversible on Postgres).
    # SQLite cannot ADD a FK constraint to an existing table; the column still
    # works there (dev), and Postgres (prod) gets the real constraint.
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_service_thumbnail_media",
            "service",
            "media_asset",
            ["thumbnail_media_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_foreign_key(
            "fk_category_thumbnail_media",
            "category",
            "media_asset",
            ["thumbnail_media_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint(
            "fk_category_thumbnail_media", "category", type_="foreignkey"
        )
        op.drop_constraint(
            "fk_service_thumbnail_media", "service", type_="foreignkey"
        )

    op.drop_index("ix_category_thumbnail_media_id", table_name="category")
    op.drop_column("category", "thumbnail_alt")
    op.drop_column("category", "thumbnail_url")
    op.drop_column("category", "thumbnail_media_id")

    op.drop_index("ix_service_thumbnail_media_id", table_name="service")
    op.drop_column("service", "thumbnail_alt")
    op.drop_column("service", "thumbnail_url")
    op.drop_column("service", "thumbnail_media_id")
    op.drop_column("service", "title_hi")

    op.drop_index("ix_content_revision_entity_id", table_name="content_revision")
    op.drop_index("ix_content_revision_entity_type", table_name="content_revision")
    op.drop_table("content_revision")
    op.drop_table("media_asset")
