"""merge discovery + push_tokens heads

Revision ID: 54a335ac54d9
Revises: 4a2a7c68abb5, d5e2f3a4b6c7
Create Date: 2026-11-22 23:53:31.858751
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

import app.db.types  # custom column types (e.g. GUID) used in migrations


revision: str = '54a335ac54d9'
down_revision: str | None = ('4a2a7c68abb5', 'd5e2f3a4b6c7')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
