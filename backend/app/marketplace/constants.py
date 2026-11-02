"""Marketplace enumerations: roles, lifecycle states and the booking state machine."""

from __future__ import annotations


class Principal:
    """Who a JWT belongs to (the token's ``kind`` claim)."""

    CUSTOMER = "customer"
    PANDIT = "pandit"
    STAFF = "staff"  # admin_user (existing), resolved by role


class StaffRole:
    """Staff roles (SRS §2). Stored on the existing admin_user.role."""

    OPS = "ops"
    VERIFICATION = "verification"
    FINANCE = "finance"
    SUPPORT = "support"
    MARKETING = "marketing"
    SUPER_ADMIN = "admin"  # existing super-admin value

    # Roles permitted to run operations / verification in Phase 1.
    OPS_ROLES = (OPS, SUPER_ADMIN)
    VERIFICATION_ROLES = (VERIFICATION, SUPER_ADMIN)
    ALL = (OPS, VERIFICATION, FINANCE, SUPPORT, MARKETING, SUPER_ADMIN)


class AccountStatus:
    ACTIVE = "active"
    SUSPENDED = "suspended"


class PanditStatus:
    """Partner onboarding / verification lifecycle (SRS PAN module)."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ACTION_REQUIRED = "action_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

    ALL = (
        DRAFT,
        SUBMITTED,
        UNDER_REVIEW,
        ACTION_REQUIRED,
        APPROVED,
        REJECTED,
        SUSPENDED,
    )
    # Only an approved partner may receive ordinary dispatch offers.
    ELIGIBLE = (APPROVED,)


class Availability:
    """Partner live availability (SRS AVL module)."""

    OFFLINE = "offline"
    ONLINE = "online"
    BUSY = "busy"
    UNAVAILABLE = "unavailable"

    ALL = (OFFLINE, ONLINE, BUSY, UNAVAILABLE)


class BookingMode:
    IMMEDIATE = "immediate"
    SCHEDULED = "scheduled"


class BookingStatus:
    """Booking lifecycle state machine (SRS §4.1)."""

    REQUESTED = "requested"
    SEARCHING = "searching"
    AWAITING_ACCEPTANCE = "awaiting_acceptance"
    CONFIRMED = "confirmed"
    EN_ROUTE = "en_route"
    ARRIVED = "arrived"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    # Terminal / exception states
    EXPIRED = "expired"
    NO_PARTNER = "no_partner_available"
    REJECTED = "rejected"
    CANCELLED_CUSTOMER = "cancelled_customer"
    CANCELLED_PARTNER = "cancelled_partner"
    CANCELLED_PLATFORM = "cancelled_platform"

    # Dispatch is actively looking for / waiting on a partner.
    DISPATCHING = (SEARCHING, AWAITING_ACCEPTANCE)
    # A partner is committed to the booking.
    ASSIGNED = (CONFIRMED, EN_ROUTE, ARRIVED, IN_PROGRESS)
    TERMINAL = (
        COMPLETED,
        EXPIRED,
        NO_PARTNER,
        REJECTED,
        CANCELLED_CUSTOMER,
        CANCELLED_PARTNER,
        CANCELLED_PLATFORM,
    )


class DispatchOutcome:
    OFFERED = "offered"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    SUPERSEDED = "superseded"  # cancelled because the booking moved on


class PaymentStatus:
    CREATED = "created"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class RefundStatus:
    PENDING = "pending"
    PROCESSED = "processed"


class PayoutStatus:
    PENDING = "pending"
    PAID = "paid"


class LedgerType:
    """Finance ledger entry kinds (SRS finance view distinguishes these)."""

    CUSTOMER_CHARGE = "customer_charge"
    GATEWAY_FEE = "gateway_fee"
    PLATFORM_COMMISSION = "platform_commission"
    PARTNER_PAYABLE = "partner_payable"
    REFUND = "refund"
    PAYOUT = "payout"


class FinanceRole:
    FINANCE = "finance"
    FINANCE_ROLES = ("finance", "admin")


class TicketStatus:
    OPEN = "open"
    ASSIGNED = "assigned"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    CLOSED = "closed"

    ALL = (OPEN, ASSIGNED, ESCALATED, RESOLVED, CLOSED)
    CLOSED_STATES = (RESOLVED, CLOSED)


class MpAudit:
    OTP_REQUEST = "mp.otp_request"
    LOGIN = "mp.login"
    BOOKING_CREATE = "mp.booking.create"
    BOOKING_CANCEL = "mp.booking.cancel"
    DISPATCH_OFFER = "mp.dispatch.offer"
    DISPATCH_ACCEPT = "mp.dispatch.accept"
    DISPATCH_REJECT = "mp.dispatch.reject"
    DISPATCH_NO_PARTNER = "mp.dispatch.no_partner"
    VERIFICATION_DECISION = "mp.verification.decision"
    MANUAL_REASSIGN = "mp.booking.reassign"
    STATUS_ADVANCE = "mp.booking.status"
    PAYMENT_ORDER = "mp.payment.order"
    PAYMENT_VERIFIED = "mp.payment.verified"
    REFUND = "mp.payment.refund"
    PAYOUT = "mp.payout.process"
    REVIEW_CREATE = "mp.review.create"
    REVIEW_MODERATE = "mp.review.moderate"
    TICKET_CREATE = "mp.ticket.create"
    TICKET_UPDATE = "mp.ticket.update"
