"""merge push_tokens + kyc migration heads

Revision ID: 4a2a7c68abb5
Revises: d4f7a2b8c1e9, e1a2b3c4d5f6
Create Date: 2026-11-22 22:24:34.337389
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

import app.db.types  # custom column types (e.g. GUID) used in migrations


revision: str = '4a2a7c68abb5'
down_revision: str | None = ('d4f7a2b8c1e9', 'e1a2b3c4d5f6')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
