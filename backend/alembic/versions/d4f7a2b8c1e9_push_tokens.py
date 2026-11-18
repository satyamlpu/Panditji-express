"""push tokens

Revision ID: d4f7a2b8c1e9
Revises: c3e6a9f1d4b7
Create Date: 2026-11-18
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

import app.db.types  # custom column types (e.g. GUID) used in migrations
from alembic import op

revision: str = "d4f7a2b8c1e9"
down_revision: str | None = "c3e6a9f1d4b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mp_push_token",
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("principal_kind", sa.String(), nullable=False),
        sa.Column("principal_id", app.db.types.GUID(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("id", app.db.types.GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("mp_push_token", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_mp_push_token_token"), ["token"], unique=True
        )
        batch_op.create_index(
            batch_op.f("ix_mp_push_token_principal_id"), ["principal_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("mp_push_token", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_mp_push_token_principal_id"))
        batch_op.drop_index(batch_op.f("ix_mp_push_token_token"))
    op.drop_table("mp_push_token")
