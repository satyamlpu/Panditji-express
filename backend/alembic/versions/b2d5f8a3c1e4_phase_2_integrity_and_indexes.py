"""phase 2 data integrity + composite indexes

Engine-portable integrity/performance hardening (Audit Phase-0, Roadmap Phase 2
— data-integrity slice; RK-08 invalid states, RK-14 index portion):

* Composite indexes for the dispatch / finance hot paths (all dialects).
* CHECK constraints pinning every state/enum column to its allowed values plus
  non-negative money and 1..5 ratings.

CHECK constraints are applied here only on PostgreSQL (the production engine),
where ``ALTER TABLE ADD CONSTRAINT`` is a cheap online change. On SQLite adding
a CHECK to an existing table needs a full table rebuild, which would also have
to reconstruct the Milestone-1 partial unique indexes; fresh SQLite databases
instead get the constraints directly from the model definitions via
``create_all`` (so the test suite still exercises them on either engine). This
keeps dev migrations safe while giving production the real guarantees.

Revision ID: b2d5f8a3c1e4
Revises: a1c4e7d9b2f0
Create Date: 2026-11-01 10:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "b2d5f8a3c1e4"
down_revision: str | None = "a1c4e7d9b2f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, name, column list) — portable, additive.
_INDEXES = [
    ("mp_pandit", "ix_pandit_dispatchable", ["status", "availability"]),
    ("mp_dispatch_attempt", "ix_dispatch_booking_outcome", ["booking_id", "outcome"]),
    ("mp_payment", "ix_payment_booking_status", ["booking_id", "status"]),
    ("mp_ledger_entry", "ix_ledger_payable", ["entry_type", "settled", "pandit_id"]),
]

# (table, name, condition) — applied on PostgreSQL only (see module docstring).
_CHECKS = [
    ("mp_customer", "ck_customer_status", "status IN ('active', 'suspended')"),
    (
        "mp_pandit",
        "ck_pandit_status",
        "status IN ('draft', 'submitted', 'under_review', 'action_required', "
        "'approved', 'rejected', 'suspended')",
    ),
    (
        "mp_pandit",
        "ck_pandit_availability",
        "availability IN ('offline', 'online', 'busy', 'unavailable')",
    ),
    (
        "mp_booking",
        "ck_booking_status",
        "status IN ('requested', 'searching', 'awaiting_acceptance', 'confirmed', "
        "'en_route', 'arrived', 'in_progress', 'completed', 'expired', "
        "'no_partner_available', 'rejected', 'cancelled_customer', "
        "'cancelled_partner', 'cancelled_platform')",
    ),
    ("mp_booking", "ck_booking_mode", "mode IN ('immediate', 'scheduled')"),
    ("mp_booking", "ck_booking_price_nonneg", "price_paise IS NULL OR price_paise >= 0"),
    (
        "mp_dispatch_attempt",
        "ck_dispatch_outcome",
        "outcome IN ('offered', 'accepted', 'rejected', 'expired', 'superseded')",
    ),
    (
        "mp_payment",
        "ck_payment_status",
        "status IN ('created', 'paid', 'failed', 'refunded', 'partially_refunded')",
    ),
    ("mp_payment", "ck_payment_amount_nonneg", "amount_paise >= 0"),
    ("mp_payment", "ck_payment_refunded_nonneg", "refunded_paise >= 0"),
    (
        "mp_ledger_entry",
        "ck_ledger_entry_type",
        "entry_type IN ('customer_charge', 'gateway_fee', 'platform_commission', "
        "'partner_payable', 'refund', 'payout')",
    ),
    ("mp_ledger_entry", "ck_ledger_amount_nonneg", "amount_paise >= 0"),
    ("mp_refund", "ck_refund_status", "status IN ('pending', 'processed')"),
    ("mp_refund", "ck_refund_amount_nonneg", "amount_paise >= 0"),
    ("mp_payout", "ck_payout_status", "status IN ('pending', 'paid')"),
    ("mp_payout", "ck_payout_amount_nonneg", "amount_paise >= 0"),
    ("mp_review", "ck_review_rating", "rating BETWEEN 1 AND 5"),
    (
        "mp_support_ticket",
        "ck_ticket_status",
        "status IN ('open', 'assigned', 'escalated', 'resolved', 'closed')",
    ),
]


def upgrade() -> None:
    for table, name, cols in _INDEXES:
        op.create_index(name, table, cols)

    if op.get_bind().dialect.name != "postgresql":
        return
    for table, name, condition in _CHECKS:
        op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for table, name, _ in reversed(_CHECKS):
            op.drop_constraint(name, table, type_="check")

    for table, name, _ in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
