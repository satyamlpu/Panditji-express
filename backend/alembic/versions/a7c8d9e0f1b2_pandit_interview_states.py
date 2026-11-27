"""extend pandit status with interview + reverification states

Adds interview_scheduled, interview_completed and reverification_required to the
partner verification lifecycle. Recreates the ck_pandit_status CHECK constraint
on PostgreSQL only (SQLite dev/test gets the constraint from create_all, per the
phase-2 integrity migration). Purely a constraint widening — no data changes.

Revision ID: a7c8d9e0f1b2
Revises: f2b3c4d5e6a7
Create Date: 2026-11-20 13:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "a7c8d9e0f1b2"
down_revision: str | None = "f2b3c4d5e6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "mp_pandit"
_NAME = "ck_pandit_status"
_NEW = (
    "status IN ('draft', 'submitted', 'under_review', 'action_required', "
    "'interview_scheduled', 'interview_completed', 'approved', 'rejected', "
    "'suspended', 'reverification_required')"
)
_OLD = (
    "status IN ('draft', 'submitted', 'under_review', 'action_required', "
    "'approved', 'rejected', 'suspended')"
)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.drop_constraint(_NAME, _TABLE, type_="check")
    op.create_check_constraint(_NAME, _TABLE, _NEW)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.drop_constraint(_NAME, _TABLE, type_="check")
    op.create_check_constraint(_NAME, _TABLE, _OLD)
