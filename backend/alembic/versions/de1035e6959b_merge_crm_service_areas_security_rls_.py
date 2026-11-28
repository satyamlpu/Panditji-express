"""merge crm service-areas + security/rls heads

Revision ID: de1035e6959b
Revises: e7a1b2c3d4f5, f1a2b3c4d5e6
Create Date: 2026-11-28 15:05:20.849982
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

import app.db.types  # custom column types (e.g. GUID) used in migrations


revision: str = 'de1035e6959b'
down_revision: str | None = ('e7a1b2c3d4f5', 'f1a2b3c4d5e6')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
