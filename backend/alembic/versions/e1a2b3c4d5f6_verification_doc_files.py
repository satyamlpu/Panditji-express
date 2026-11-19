"""verification document file metadata

Adds the columns needed to attach a real uploaded KYC file to a verification
document: a human ``note`` (the short label the partner types, split out from
the former overloaded ``file_ref``), plus ``content_type`` and ``size_bytes``
for the stored object. ``file_ref`` now holds the private storage key of the
uploaded file (see ``app/marketplace/storage.py``) rather than the note.

All columns are nullable and additive, so the change is safe on both engines and
needs no backfill (existing dev rows simply have no attached file).

Revision ID: e1a2b3c4d5f6
Revises: c3e6a9f1d4b7
Create Date: 2026-11-19 10:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1a2b3c4d5f6"
down_revision: str | None = "c3e6a9f1d4b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "mp_verification_document"


def upgrade() -> None:
    op.add_column(_TABLE, sa.Column("note", sa.Text(), nullable=True))
    op.add_column(_TABLE, sa.Column("content_type", sa.String(), nullable=True))
    op.add_column(_TABLE, sa.Column("size_bytes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column(_TABLE, "size_bytes")
    op.drop_column(_TABLE, "content_type")
    op.drop_column(_TABLE, "note")
