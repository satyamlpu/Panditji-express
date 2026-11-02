"""milestone 1 concurrency invariants

Durable database guards that make the booking/money core safe under
concurrency (Audit Phase-0, Milestone 1 / Roadmap Phase 1):

* ``uq_dispatch_one_accepted`` — at most one ACCEPTED dispatch attempt per
  booking, so a booking can never be assigned to two partners.
* ``uq_payment_open_per_booking`` — at most one open (created/paid) payment per
  booking, so concurrent order creation / webhooks can't post two live charges.

Both are *partial* unique indexes, supported on PostgreSQL and SQLite alike.

Revision ID: a1c4e7d9b2f0
Revises: 47fbc8448ade
Create Date: 2026-10-31 17:30:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c4e7d9b2f0"
down_revision: str | None = "47fbc8448ade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "uq_dispatch_one_accepted",
        "mp_dispatch_attempt",
        ["booking_id"],
        unique=True,
        sqlite_where=sa.text("outcome = 'accepted'"),
        postgresql_where=sa.text("outcome = 'accepted'"),
    )
    op.create_index(
        "uq_payment_open_per_booking",
        "mp_payment",
        ["booking_id"],
        unique=True,
        sqlite_where=sa.text("status IN ('created', 'paid')"),
        postgresql_where=sa.text("status IN ('created', 'paid')"),
    )


def downgrade() -> None:
    op.drop_index("uq_payment_open_per_booking", table_name="mp_payment")
    op.drop_index("uq_dispatch_one_accepted", table_name="mp_dispatch_attempt")
