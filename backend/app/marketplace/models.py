"""Marketplace data model (SRS §9).

Geo is stored as plain lat/lng floats here; eligibility uses a haversine
distance in the dispatch service. In production these become PostGIS geography
columns with spatial indexes — the dispatch query is the only thing that changes.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID
from app.marketplace.constants import (
    AccountStatus,
    Availability,
    BookingStatus,
    DispatchOutcome,
    PanditStatus,
)


# ── Accounts ─────────────────────────────────────────────────────────────────
class Customer(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_customer"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'suspended')", name="ck_customer_status"
        ),
    )

    phone: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(nullable=True)
    language: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(default=AccountStatus.ACTIVE, nullable=False)


class CustomerAddress(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_customer_address"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_customer.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str | None] = mapped_column(nullable=True)  # Home, Office…
    line: Mapped[str] = mapped_column(Text, nullable=False)
    landmark: Mapped[str | None] = mapped_column(nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)


class Pandit(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_pandit"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'submitted', 'under_review', 'action_required', "
            "'approved', 'rejected', 'suspended')",
            name="ck_pandit_status",
        ),
        CheckConstraint(
            "availability IN ('offline', 'online', 'busy', 'unavailable')",
            name="ck_pandit_availability",
        ),
        # Serves the dispatch eligibility filter (approved + online).
        Index("ix_pandit_dispatchable", "status", "availability"),
    )

    phone: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(nullable=True)
    languages: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list[str]
    city: Mapped[str | None] = mapped_column(nullable=True)

    # Verification lifecycle + reviewer trail
    status: Mapped[str] = mapped_column(
        default=PanditStatus.DRAFT, nullable=False, index=True
    )
    verification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Live availability (heartbeat-gated)
    availability: Mapped[str] = mapped_column(
        default=Availability.OFFLINE, nullable=False, index=True
    )
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Base location + how far they will travel
    base_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    base_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_radius_km: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)

    # Lightweight reliability signal used in ranking (SRS DSP ranking criteria)
    offers_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Latest live location (only kept while on an active booking; overwritten,
    # not historised — minimal location retention, SRS GEO module).
    live_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Rating aggregate (updated when a review is created)
    rating_sum: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class PanditCapability(UUIDPk, Timestamps, Base):
    """Which catalogue services a pandit can perform (reuses the `service` table)."""

    __tablename__ = "mp_pandit_capability"
    __table_args__ = (
        UniqueConstraint("pandit_id", "service_id", name="uq_pandit_service"),
    )

    pandit_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("service.id", ondelete="CASCADE"), nullable=False, index=True
    )


class VerificationDocument(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_verification_document"

    pandit_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(nullable=False)  # id_proof, address_proof…
    file_ref: Mapped[str | None] = mapped_column(nullable=True)  # private storage path
    status: Mapped[str] = mapped_column(default="pending", nullable=False)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


# ── Bookings ─────────────────────────────────────────────────────────────────
class Booking(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_booking"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested', 'searching', 'awaiting_acceptance', "
            "'confirmed', 'en_route', 'arrived', 'in_progress', 'completed', "
            "'expired', 'no_partner_available', 'rejected', 'cancelled_customer', "
            "'cancelled_partner', 'cancelled_platform')",
            name="ck_booking_status",
        ),
        CheckConstraint(
            "mode IN ('immediate', 'scheduled')", name="ck_booking_mode"
        ),
        CheckConstraint(
            "price_paise IS NULL OR price_paise >= 0", name="ck_booking_price_nonneg"
        ),
    )

    code: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_customer.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("service.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    mode: Mapped[str] = mapped_column(nullable=False)  # immediate / scheduled
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    status: Mapped[str] = mapped_column(
        default=BookingStatus.REQUESTED, nullable=False, index=True
    )

    # Destination (address snapshot — survives address edits/deletes)
    address_line: Mapped[str] = mapped_column(Text, nullable=False)
    landmark: Mapped[str | None] = mapped_column(nullable=True)
    dest_lat: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lng: Mapped[float] = mapped_column(Float, nullable=False)

    # Price + service snapshot (never mutated after creation)
    service_title_snapshot: Mapped[str] = mapped_column(nullable=False)
    price_paise: Mapped[int | None] = mapped_column(Integer, nullable=True)

    assigned_pandit_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="SET NULL"), nullable=True, index=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class DispatchAttempt(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_dispatch_attempt"
    # Core safety invariant: at most one *accepted* offer per booking. This is
    # the durable backstop that prevents double-assignment even if the service
    # guard is bypassed or two accepts race (a second ACCEPTED row is rejected
    # at the database). A partial index so the many OFFERED/EXPIRED/etc. rows
    # per booking are unconstrained. Mirrored in the Alembic migration.
    __table_args__ = (
        Index(
            "uq_dispatch_one_accepted",
            "booking_id",
            unique=True,
            sqlite_where=text("outcome = 'accepted'"),
            postgresql_where=text("outcome = 'accepted'"),
        ),
        Index("ix_dispatch_booking_outcome", "booking_id", "outcome"),
        CheckConstraint(
            "outcome IN ('offered', 'accepted', 'rejected', 'expired', 'superseded')",
            name="ck_dispatch_outcome",
        ),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pandit_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    offered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    outcome: Mapped[str] = mapped_column(
        default=DispatchOutcome.OFFERED, nullable=False, index=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class BookingEvent(UUIDPk, Timestamps, Base):
    """Append-only booking lifecycle history (SRS booking_status_events)."""

    __tablename__ = "mp_booking_event"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(nullable=True)
    to_status: Mapped[str] = mapped_column(nullable=False)
    actor: Mapped[str] = mapped_column(nullable=False)  # system / customer / pandit / admin:email
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)


# ── Finance (Phase 3) ────────────────────────────────────────────────────────
class Payment(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_payment"
    # At most one *open* (created or paid) payment per booking, so concurrent
    # order creation / webhook processing can never post two live charges for
    # the same booking. Refunded/failed rows fall outside the partial index, so
    # a booking can be re-charged after a full refund. Mirrored in the migration.
    __table_args__ = (
        Index(
            "uq_payment_open_per_booking",
            "booking_id",
            unique=True,
            sqlite_where=text("status IN ('created', 'paid')"),
            postgresql_where=text("status IN ('created', 'paid')"),
        ),
        Index("ix_payment_booking_status", "booking_id", "status"),
        CheckConstraint(
            "status IN ('created', 'paid', 'failed', 'refunded', "
            "'partially_refunded')",
            name="ck_payment_status",
        ),
        CheckConstraint("amount_paise >= 0", name="ck_payment_amount_nonneg"),
        CheckConstraint("refunded_paise >= 0", name="ck_payment_refunded_nonneg"),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(default="created", nullable=False, index=True)
    provider_order_id: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    # Set once the (mock) gateway confirms; unique so duplicate webhooks are no-ops.
    provider_payment_id: Mapped[str | None] = mapped_column(
        unique=True, index=True, nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class LedgerEntry(UUIDPk, Timestamps, Base):
    """Append-only finance ledger. Amounts are positive magnitudes; the
    ``entry_type`` implies the direction. Partner-payable rows carry pandit_id
    and are marked settled when a payout covers them."""

    __tablename__ = "mp_ledger_entry"
    __table_args__ = (
        # Serves outstanding-payable grouping and payout selection.
        Index("ix_ledger_payable", "entry_type", "settled", "pandit_id"),
        CheckConstraint(
            "entry_type IN ('customer_charge', 'gateway_fee', "
            "'platform_commission', 'partner_payable', 'refund', 'payout')",
            name="ck_ledger_entry_type",
        ),
        CheckConstraint("amount_paise >= 0", name="ck_ledger_amount_nonneg"),
    )

    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="SET NULL"), nullable=True, index=True
    )
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_payment.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pandit_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="SET NULL"), nullable=True, index=True
    )
    entry_type: Mapped[str] = mapped_column(nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    payout_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)


class Refund(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_refund"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'processed')", name="ck_refund_status"
        ),
        CheckConstraint("amount_paise >= 0", name="ck_refund_amount_nonneg"),
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_payment.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(default="processed", nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_refund_id: Mapped[str] = mapped_column(unique=True, nullable=False)
    created_by: Mapped[str | None] = mapped_column(nullable=True)


class Payout(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_payout"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'paid')", name="ck_payout_status"),
        CheckConstraint("amount_paise >= 0", name="ck_payout_amount_nonneg"),
    )

    pandit_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    bookings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(default="paid", nullable=False)
    created_by: Mapped[str | None] = mapped_column(nullable=True)


# ── Reviews (Phase 3) ────────────────────────────────────────────────────────
class Review(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_review"
    __table_args__ = (
        UniqueConstraint("booking_id", name="uq_review_booking"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_customer.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pandit_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_pandit.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


# ── Support (Phase 3) ────────────────────────────────────────────────────────
class SupportTicket(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_support_ticket"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'assigned', 'escalated', 'resolved', 'closed')",
            name="ck_ticket_status",
        ),
    )

    ref: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    opener_kind: Mapped[str] = mapped_column(nullable=False)  # customer / pandit
    opener_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="SET NULL"), nullable=True, index=True
    )
    subject: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(default="open", nullable=False, index=True)
    assignee_email: Mapped[str | None] = mapped_column(nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)


class TicketMessage(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_ticket_message"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("mp_support_ticket.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author: Mapped[str] = mapped_column(nullable=False)  # customer / pandit / admin:email
    body: Mapped[str] = mapped_column(Text, nullable=False)


class Notification(UUIDPk, Timestamps, Base):
    """In-app notification feed (SRS NTF module). Not a source of truth for
    booking status; push/SMS/email channels layer on top in later phases."""

    __tablename__ = "mp_notification"

    recipient_kind: Mapped[str] = mapped_column(nullable=False)  # customer / pandit
    recipient_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False, index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("mp_booking.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


# Marketplace OTP (dev implementation; a provider replaces this in production)
class OtpCode(UUIDPk, Timestamps, Base):
    __tablename__ = "mp_otp_code"

    phone: Mapped[str] = mapped_column(index=True, nullable=False)
    kind: Mapped[str] = mapped_column(nullable=False)  # customer / pandit
    code_hash: Mapped[str] = mapped_column(nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
