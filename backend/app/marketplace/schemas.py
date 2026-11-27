"""Request/response schemas for the marketplace API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Kind = Literal["customer", "pandit"]


# ── Auth ─────────────────────────────────────────────────────────────────────
class OtpRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    kind: Kind


class OtpRequestOut(BaseModel):
    message: str
    dev_code: str | None = None  # dev only; never populated in production


class OtpVerify(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    kind: Kind
    code: str = Field(min_length=4, max_length=8)
    name: str | None = Field(default=None, max_length=120)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    kind: Kind
    id: str


# ── Customer ─────────────────────────────────────────────────────────────────
class CustomerOut(BaseModel):
    id: str
    phone: str
    name: str | None
    language: str | None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    language: str | None = Field(default=None, max_length=40)


class AddressCreate(BaseModel):
    label: str | None = Field(default=None, max_length=40)
    line: str = Field(min_length=3)
    landmark: str | None = Field(default=None, max_length=160)
    instructions: str | None = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class AddressOut(BaseModel):
    id: str
    label: str | None
    line: str
    landmark: str | None
    instructions: str | None
    lat: float
    lng: float


# ── Bookings ─────────────────────────────────────────────────────────────────
class BookingCreate(BaseModel):
    service_slug: str
    mode: Literal["immediate", "scheduled"] = "immediate"
    scheduled_at: datetime | None = None
    address_id: str | None = None
    # Inline address (used when no saved address_id is given)
    address_line: str | None = None
    landmark: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class PanditBrief(BaseModel):
    id: str
    name: str | None
    languages: list[str] | None = None


class BookingOut(BaseModel):
    id: str
    code: str
    status: str
    service_title: str
    price_display: str
    mode: str
    scheduled_at: datetime | None
    address_line: str
    landmark: str | None
    dest_lat: float
    dest_lng: float
    assigned_pandit: PanditBrief | None
    created_at: datetime
    confirmed_at: datetime | None


class BookingEventOut(BaseModel):
    from_status: str | None
    to_status: str
    actor: str
    reason: str | None
    at: datetime


class CancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


# ── Pandit app ───────────────────────────────────────────────────────────────
class PanditOnboard(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    languages: list[str] = Field(default_factory=list)
    city: str | None = Field(default=None, max_length=80)
    base_lat: float = Field(ge=-90, le=90)
    base_lng: float = Field(ge=-180, le=180)
    service_radius_km: float = Field(default=10, ge=1, le=100)
    service_slugs: list[str] = Field(default_factory=list)


class CapabilityRef(BaseModel):
    service_id: str
    slug: str
    title: str


class PanditOut(BaseModel):
    id: str
    phone: str
    name: str | None
    languages: list[str] | None
    city: str | None
    status: str
    availability: str
    base_lat: float | None
    base_lng: float | None
    service_radius_km: float
    rating_avg: float | None
    rating_count: int
    capabilities: list[CapabilityRef]


class AvailabilityUpdate(BaseModel):
    availability: Literal["online", "offline", "unavailable"]


class OfferOut(BaseModel):
    booking_id: str
    code: str
    service_title: str
    address_line: str
    landmark: str | None
    dest_lat: float
    dest_lng: float
    distance_km: float | None
    price_display: str
    offered_at: datetime
    expires_at: datetime


# ── Discovery ────────────────────────────────────────────────────────────────
class PanditSearchItem(BaseModel):
    id: str
    name: str | None
    languages: list[str] | None
    distance_km: float
    service_radius_km: float
    rating_avg: float | None = None
    rating_count: int = 0


class Serviceability(BaseModel):
    serviceable: bool
    reason: str | None = None
    available_partners: int = 0


# ── Admin ────────────────────────────────────────────────────────────────────
class PanditAdminOut(BaseModel):
    id: str
    name: str | None
    phone: str
    city: str | None
    status: str
    availability: str
    capability_count: int
    verification_reason: str | None
    reviewed_by: str | None
    created_at: datetime


class VerificationDecision(BaseModel):
    decision: Literal["approve", "reject", "request_changes", "suspend"]
    reason: str | None = Field(default=None, max_length=500)


class VerificationDocumentOut(BaseModel):
    # Submitted via multipart form (doc_type + optional note + optional file) on
    # the partner `POST /verification/documents` route. The storage key is never
    # exposed — only whether a file is attached and its type.
    id: str
    doc_type: str
    reference: str | None  # the human note (model field `note`)
    has_file: bool  # whether an actual file is attached in private storage
    content_type: str | None  # MIME type of the attached file, if any
    status: str
    decision_reason: str | None
    created_at: datetime


class VerificationStatusOut(BaseModel):
    status: str
    documents: list[VerificationDocumentOut]


class BookingAdminOut(BaseModel):
    id: str
    code: str
    status: str
    service_title: str
    customer_name: str | None
    customer_phone: str
    assigned_pandit: PanditBrief | None
    price_display: str
    mode: str
    created_at: datetime
    confirmed_at: datetime | None


class DispatchAttemptOut(BaseModel):
    pandit_id: str
    pandit_name: str | None
    rank: int
    distance_km: float | None
    outcome: str
    offered_at: datetime
    expires_at: datetime
    responded_at: datetime | None


class BookingAdminDetail(BookingAdminOut):
    address_line: str
    landmark: str | None
    dest_lat: float
    dest_lng: float
    events: list[BookingEventOut]
    attempts: list[DispatchAttemptOut]
    # Live partner location (need-to-know; only while active)
    live_lat: float | None = None
    live_lng: float | None = None
    live_freshness_seconds: int | None = None
    live_eta_minutes: int | None = None


class ReassignRequest(BaseModel):
    pandit_id: str
    reason: str = Field(min_length=2, max_length=500)


# ── Tracking & notifications (Phase 2) ───────────────────────────────────────
class LocationPing(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=10000)


class TrackingOut(BaseModel):
    booking_status: str
    pandit_name: str | None
    has_location: bool
    lat: float | None
    lng: float | None
    updated_at: datetime | None
    freshness_seconds: int | None
    is_stale: bool
    eta_minutes: int | None
    dest_lat: float
    dest_lng: float


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str | None
    booking_id: str | None
    read: bool
    created_at: datetime


# ── Payments & finance (Phase 3) ─────────────────────────────────────────────
class OrderOut(BaseModel):
    payment_id: str
    provider_order_id: str
    amount_paise: int
    amount_display: str
    status: str
    note: str


class PaymentOut(BaseModel):
    id: str
    booking_code: str
    amount_paise: int
    amount_display: str
    status: str
    provider_order_id: str
    provider_payment_id: str | None
    refunded_paise: int
    paid_at: datetime | None
    created_at: datetime


class LedgerEntryOut(BaseModel):
    entry_type: str
    amount_paise: int
    amount_display: str
    created_at: datetime


class RefundRequest(BaseModel):
    amount_paise: int | None = Field(default=None, ge=1)
    reason: str | None = Field(default=None, max_length=500)


class PayoutDue(BaseModel):
    pandit_id: str
    pandit_name: str | None
    amount_paise: int
    amount_display: str
    bookings: int


class PayoutRequest(BaseModel):
    pandit_id: str


class FinanceSummaryOut(BaseModel):
    gross_booking_value_paise: int
    platform_commission_paise: int
    gateway_fees_paise: int
    partner_payable_paise: int
    refunds_paise: int
    paid_out_paise: int
    outstanding_payable_paise: int


# ── Reviews (Phase 3) ────────────────────────────────────────────────────────
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    id: str
    booking_code: str
    rating: int
    comment: str | None
    customer_name: str | None
    pandit_name: str | None
    reported: bool
    hidden: bool
    created_at: datetime


class ReviewModerate(BaseModel):
    hidden: bool


# ── Support tickets (Phase 3) ────────────────────────────────────────────────
class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=3, max_length=4000)
    booking_id: str | None = None


class TicketMessageOut(BaseModel):
    author: str
    body: str
    at: datetime


class TicketOut(BaseModel):
    id: str
    ref: str
    subject: str
    status: str
    assignee_email: str | None
    booking_code: str | None
    opener_kind: str
    opener_label: str | None = None
    created_at: datetime
    updated_at: datetime


class TicketDetailOut(TicketOut):
    resolution: str | None = None
    messages: list[TicketMessageOut]


class TicketReply(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TicketAssign(BaseModel):
    assignee_email: str | None = None  # defaults to the acting staff member


class TicketStatusUpdate(BaseModel):
    status: Literal["open", "assigned", "escalated", "resolved", "closed"]
    resolution: str | None = Field(default=None, max_length=2000)


class DashboardOut(BaseModel):
    bookings_by_status: dict[str, int]
    partners_approved: int
    partners_online: int
    partners_busy: int
    pending_verifications: int
    no_match_rate: float
    bookings_today: int


# ── Customers CRM (admin) ────────────────────────────────────────────────────
class CustomerAdminOut(BaseModel):
    id: str
    phone: str
    name: str | None
    language: str | None
    status: str
    created_at: datetime
    bookings_count: int
    completed_count: int
    cancelled_count: int
    total_spent_paise: int
    total_spent_display: str
    review_count: int
    open_tickets: int
    last_booking_at: datetime | None


class CustomerListOut(BaseModel):
    items: list[CustomerAdminOut]
    total: int
    page: int
    page_size: int


class CustomerAdminDetail(CustomerAdminOut):
    addresses: list[AddressOut]


class CustomerStatusUpdate(BaseModel):
    reason: str = Field(min_length=2, max_length=500)


class CustomerActivityOut(BaseModel):
    action: str
    actor_email: str | None
    at: datetime
    meta: dict | None = None


class CustomerExportOut(BaseModel):
    profile: CustomerAdminDetail
    bookings: list[BookingOut]
    payments: list[PaymentOut]
    reviews: list[ReviewOut]
    tickets: list[TicketOut]
    exported_at: datetime
    exported_by: str


# ── Partner management CRM (admin) ───────────────────────────────────────────
class PartnerAdminRow(BaseModel):
    id: str
    name: str | None
    phone: str
    city: str | None
    status: str
    availability: str
    capability_count: int
    rating_avg: float | None
    rating_count: int
    completed_count: int
    acceptance_rate: float | None
    outstanding_paise: int
    outstanding_display: str
    created_at: datetime


class PartnerListOut(BaseModel):
    items: list[PartnerAdminRow]
    total: int
    page: int
    page_size: int


class PartnerPerformance(BaseModel):
    offers_received: int
    offers_accepted: int
    acceptance_rate: float | None
    completed_count: int
    cancelled_count: int
    active_count: int
    rating_avg: float | None
    rating_count: int


class PartnerEarnings(BaseModel):
    lifetime_earned_paise: int
    lifetime_earned_display: str
    paid_out_paise: int
    paid_out_display: str
    outstanding_paise: int
    outstanding_display: str


class PartnerOverview(BaseModel):
    id: str
    name: str | None
    phone: str
    city: str | None
    status: str
    availability: str
    languages: list[str] | None
    base_lat: float | None
    base_lng: float | None
    service_radius_km: float
    verification_reason: str | None
    reviewed_by: str | None
    created_at: datetime
    capabilities: list[CapabilityRef]
    performance: PartnerPerformance
    earnings: PartnerEarnings


class PartnerEarningRow(BaseModel):
    entry_type: str
    amount_paise: int
    amount_display: str
    booking_code: str | None
    settled: bool
    created_at: datetime


class PartnerPayoutRow(BaseModel):
    amount_paise: int
    amount_display: str
    bookings_count: int
    status: str
    created_at: datetime


class PartnerEarningsDetail(BaseModel):
    summary: PartnerEarnings
    entries: list[PartnerEarningRow]
    payouts: list[PartnerPayoutRow]


# ── Live Operations Centre (admin) ───────────────────────────────────────────
class OpsPartnerCounts(BaseModel):
    online: int
    busy: int
    offline: int
    unavailable: int
    approved_total: int


class OpsBookingCounts(BaseModel):
    dispatching: int
    active: int
    unassigned: int
    scheduled_upcoming: int
    completed_today: int


class OpsActiveBooking(BaseModel):
    id: str
    code: str
    status: str
    customer_name: str | None
    partner_id: str | None
    partner_name: str | None
    live_lat: float | None
    live_lng: float | None
    live_fresh_seconds: int | None
    eta_minutes: int | None
    dest_lat: float
    dest_lng: float


class OpsDispatchBooking(BaseModel):
    id: str
    code: str
    status: str
    created_at: datetime
    waiting_seconds: int
    offers_count: int
    current_partner_name: str | None


class OpsUnassignedBooking(BaseModel):
    id: str
    code: str
    status: str
    created_at: datetime
    waiting_seconds: int


class OpsAlert(BaseModel):
    id: str
    code: str
    status: str
    kind: str  # stuck_dispatch | no_partner | stale_location
    since_seconds: int | None


class OpsOverviewOut(BaseModel):
    generated_at: datetime
    partners: OpsPartnerCounts
    bookings: OpsBookingCounts
    active: list[OpsActiveBooking]
    dispatching: list[OpsDispatchBooking]
    unassigned: list[OpsUnassignedBooking]
    alerts: list[OpsAlert]


class OpsMapPartner(BaseModel):
    id: str
    name: str | None
    availability: str
    lat: float
    lng: float
    is_live: bool


class OpsMapDestination(BaseModel):
    code: str
    lat: float
    lng: float
    status: str


class OpsMapOut(BaseModel):
    center_lat: float | None
    center_lng: float | None
    partners: list[OpsMapPartner]
    destinations: list[OpsMapDestination]


# ── Audit log + permissions (admin) ──────────────────────────────────────────
class AuditLogRow(BaseModel):
    id: str
    action: str
    actor_email: str | None
    entity: str | None
    entity_id: str | None
    ip: str | None
    meta: dict | None
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogRow]
    total: int
    page: int
    page_size: int


class AuditMetaOut(BaseModel):
    actions: list[str]
    entities: list[str]


class PermissionRow(BaseModel):
    module: str
    roles: list[str]
    description: str


class PermissionMatrixOut(BaseModel):
    roles: list[str]
    modules: list[PermissionRow]


# ── Finance reporting & reconciliation (admin) ───────────────────────────────
class ReconciliationTotals(BaseModel):
    gross_booking_value_paise: int
    gross_booking_value_display: str
    platform_commission_paise: int
    platform_commission_display: str
    gateway_fees_paise: int
    gateway_fees_display: str
    partner_payable_paise: int
    partner_payable_display: str
    refunds_paise: int
    refunds_display: str
    payouts_paise: int
    payouts_display: str
    net_platform_revenue_paise: int
    net_platform_revenue_display: str
    outstanding_payable_paise: int
    outstanding_payable_display: str


class FinanceDayRow(BaseModel):
    date: str
    charges_paise: int
    commission_paise: int
    gateway_paise: int
    payable_paise: int
    refunds_paise: int
    payouts_paise: int


class ReconciliationOut(BaseModel):
    range_days: int
    totals: ReconciliationTotals
    by_day: list[FinanceDayRow]


class LedgerFeedRow(BaseModel):
    id: str
    entry_type: str
    amount_paise: int
    amount_display: str
    booking_code: str | None
    pandit_id: str | None
    settled: bool
    created_at: datetime


class LedgerFeedOut(BaseModel):
    items: list[LedgerFeedRow]
    total: int
    page: int
    page_size: int


class RefundRow(BaseModel):
    id: str
    booking_code: str | None
    amount_paise: int
    amount_display: str
    reason: str | None
    status: str
    created_by: str | None
    created_at: datetime


# ── Support metrics (admin) ──────────────────────────────────────────────────
class SupportMetricsOut(BaseModel):
    open: int
    assigned: int
    escalated: int
    unassigned: int
    resolved_today: int
    oldest_open_hours: float | None
    sla_breaches: int
    sla_threshold_hours: int


# ── System health (admin) ────────────────────────────────────────────────────
class SystemDatabase(BaseModel):
    status: str
    dialect: str


class SystemCounters(BaseModel):
    customers: int
    pandits_total: int
    pandits_approved: int
    pandits_online: int
    bookings_total: int
    bookings_active: int
    bookings_dispatching: int
    bookings_no_partner: int
    reviews: int
    open_tickets: int
    payments: int


class SystemConfigOut(BaseModel):
    environment: str
    is_production: bool
    geo_backend: str
    storage_backend: str
    media_storage_backend: str
    commission_percent: float
    gateway_fee_percent: float
    cors_origins: int
    docs_enabled: bool
    supabase_kyc_configured: bool
    supabase_media_configured: bool
    revalidate_configured: bool


class SystemHealthOut(BaseModel):
    status: str
    generated_at: datetime
    database: SystemDatabase
    counters: SystemCounters
    config: SystemConfigOut
    warnings: list[str]


# ── Service areas (admin) ────────────────────────────────────────────────────
class ServiceAreaOut(BaseModel):
    id: str
    name: str
    city: str | None
    center_lat: float
    center_lng: float
    radius_km: float
    pincodes: list[str]
    active: bool
    notes: str | None
    created_at: datetime


class ServiceAreaCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    city: str | None = Field(default=None, max_length=80)
    center_lat: float = Field(ge=-90, le=90)
    center_lng: float = Field(ge=-180, le=180)
    radius_km: float = Field(gt=0, le=500)
    pincodes: list[str] = Field(default_factory=list)
    active: bool = True
    notes: str | None = Field(default=None, max_length=500)


class ServiceAreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    city: str | None = Field(default=None, max_length=80)
    center_lat: float | None = Field(default=None, ge=-90, le=90)
    center_lng: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=500)
    pincodes: list[str] | None = None
    active: bool | None = None
    notes: str | None = Field(default=None, max_length=500)


class CoverageOut(BaseModel):
    lat: float
    lng: float
    covered: bool
    areas: list[ServiceAreaOut]
