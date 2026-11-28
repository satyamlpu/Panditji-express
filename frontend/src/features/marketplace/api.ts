import { api } from "@/lib/api";

export interface MpDashboard {
  bookings_by_status: Record<string, number>;
  partners_approved: number;
  partners_online: number;
  partners_busy: number;
  pending_verifications: number;
  no_match_rate: number;
  bookings_today: number;
}

export interface PanditAdmin {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  status: string;
  availability: string;
  capability_count: number;
  verification_reason: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface CapabilityRef {
  service_id: string;
  slug: string;
  title: string;
}

export interface PanditDetail {
  id: string;
  phone: string;
  name: string | null;
  languages: string[] | null;
  city: string | null;
  status: string;
  availability: string;
  base_lat: number | null;
  base_lng: number | null;
  service_radius_km: number;
  experience_years: number | null;
  specialisation: string | null;
  capabilities: CapabilityRef[];
}

export interface PanditBrief {
  id: string;
  name: string | null;
}

export interface VerificationDocument {
  id: string;
  doc_type: string;
  reference: string | null;
  has_file: boolean;
  content_type: string | null;
  status: string;
  decision_reason: string | null;
  created_at: string;
}

export interface BookingAdmin {
  id: string;
  code: string;
  status: string;
  service_title: string;
  customer_name: string | null;
  customer_phone: string;
  assigned_pandit: PanditBrief | null;
  price_display: string;
  mode: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface BookingEventRow {
  from_status: string | null;
  to_status: string;
  actor: string;
  reason: string | null;
  at: string;
}

export interface DispatchAttemptRow {
  pandit_id: string;
  pandit_name: string | null;
  rank: number;
  distance_km: number | null;
  outcome: string;
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
}

export interface BookingDetail extends BookingAdmin {
  address_line: string;
  landmark: string | null;
  dest_lat: number;
  dest_lng: number;
  events: BookingEventRow[];
  attempts: DispatchAttemptRow[];
  live_lat: number | null;
  live_lng: number | null;
  live_freshness_seconds: number | null;
  live_eta_minutes: number | null;
}

export interface FinanceSummary {
  gross_booking_value_paise: number;
  platform_commission_paise: number;
  gateway_fees_paise: number;
  partner_payable_paise: number;
  refunds_paise: number;
  paid_out_paise: number;
  outstanding_payable_paise: number;
}

export interface Payment {
  id: string;
  booking_code: string;
  amount_paise: number;
  amount_display: string;
  status: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  refunded_paise: number;
  paid_at: string | null;
  created_at: string;
}

export interface LedgerEntryRow {
  entry_type: string;
  amount_paise: number;
  amount_display: string;
  created_at: string;
}

export interface PayoutDue {
  pandit_id: string;
  pandit_name: string | null;
  amount_paise: number;
  amount_display: string;
  bookings: number;
}

export interface Review {
  id: string;
  booking_code: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  pandit_name: string | null;
  reported: boolean;
  hidden: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  ref: string;
  subject: string;
  status: string;
  assignee_email: string | null;
  booking_code: string | null;
  opener_kind: string;
  opener_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  author: string;
  body: string;
  at: string;
}

export interface SupportMetrics {
  open: number;
  assigned: number;
  escalated: number;
  unassigned: number;
  resolved_today: number;
  oldest_open_hours: number | null;
  sla_breaches: number;
  sla_threshold_hours: number;
}

export interface TicketDetail extends Ticket {
  resolution: string | null;
  messages: TicketMessage[];
}

export interface AuditLogRow {
  id: string;
  action: string;
  actor_email: string | null;
  entity: string | null;
  entity_id: string | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLogRow[];
export interface CustomerAdmin {
  id: string;
  phone: string;
  name: string | null;
  language: string | null;
  status: string;
  created_at: string;
  bookings_count: number;
  completed_count: number;
  cancelled_count: number;
  total_spent_paise: number;
  total_spent_display: string;
  review_count: number;
  open_tickets: number;
  last_booking_at: string | null;
}

export interface CustomerList {
  items: CustomerAdmin[];
export interface PartnerRow {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  status: string;
  availability: string;
  capability_count: number;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  acceptance_rate: number | null;
  outstanding_paise: number;
  outstanding_display: string;
  created_at: string;
}

export interface PartnerList {
  items: PartnerRow[];
export interface ReconciliationTotals {
  gross_booking_value_paise: number;
  gross_booking_value_display: string;
  platform_commission_paise: number;
  platform_commission_display: string;
  gateway_fees_paise: number;
  gateway_fees_display: string;
  partner_payable_paise: number;
  partner_payable_display: string;
  refunds_paise: number;
  refunds_display: string;
  payouts_paise: number;
  payouts_display: string;
  net_platform_revenue_paise: number;
  net_platform_revenue_display: string;
  outstanding_payable_paise: number;
  outstanding_payable_display: string;
}

export interface FinanceDayRow {
  date: string;
  charges_paise: number;
  commission_paise: number;
  gateway_paise: number;
  payable_paise: number;
  refunds_paise: number;
  payouts_paise: number;
}

export interface Reconciliation {
  range_days: number;
  totals: ReconciliationTotals;
  by_day: FinanceDayRow[];
}

export interface LedgerFeedRow {
  id: string;
  entry_type: string;
  amount_paise: number;
  amount_display: string;
  booking_code: string | null;
  pandit_id: string | null;
  settled: boolean;
  created_at: string;
}

export interface LedgerFeed {
  items: LedgerFeedRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditMeta {
  actions: string[];
  entities: string[];
}

export interface PermissionRow {
  module: string;
  roles: string[];
  description: string;
}

export interface PermissionMatrix {
  roles: string[];
  modules: PermissionRow[];
}

export interface AuditListParams {
  action?: string;
  entity?: string;
  actor?: string;
  q?: string;
export interface CustomerAddress {
  id: string;
  label: string | null;
  line: string;
  landmark: string | null;
  instructions: string | null;
  lat: number;
  lng: number;
}

export interface CustomerDetail extends CustomerAdmin {
  addresses: CustomerAddress[];
}

export interface CustomerBooking {
export interface PartnerPerformance {
  offers_received: number;
  offers_accepted: number;
  acceptance_rate: number | null;
  completed_count: number;
  cancelled_count: number;
  active_count: number;
  rating_avg: number | null;
  rating_count: number;
}

export interface PartnerEarningsSummary {
  lifetime_earned_paise: number;
  lifetime_earned_display: string;
  paid_out_paise: number;
  paid_out_display: string;
  outstanding_paise: number;
  outstanding_display: string;
}

export interface PartnerOverview {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  status: string;
  availability: string;
  languages: string[] | null;
  base_lat: number | null;
  base_lng: number | null;
  service_radius_km: number;
  verification_reason: string | null;
  reviewed_by: string | null;
  created_at: string;
  capabilities: CapabilityRef[];
  performance: PartnerPerformance;
  earnings: PartnerEarningsSummary;
}

export interface PartnerEarningRow {
  entry_type: string;
  amount_paise: number;
  amount_display: string;
  booking_code: string | null;
  settled: boolean;
  created_at: string;
}

export interface PartnerPayoutRow {
  amount_paise: number;
  amount_display: string;
  bookings_count: number;
  status: string;
  created_at: string;
}

export interface PartnerEarningsDetail {
  summary: PartnerEarningsSummary;
  entries: PartnerEarningRow[];
  payouts: PartnerPayoutRow[];
}

export interface PartnerBookingRow {
  id: string;
  code: string;
  status: string;
  service_title: string;
  price_display: string;
  mode: string;
  created_at: string;
}

export interface CustomerActivity {
  action: string;
  actor_email: string | null;
  at: string;
  meta: Record<string, unknown> | null;
}

export interface CustomerListParams {
  q?: string;
  status?: string;
export interface PartnerListParams {
  q?: string;
  status?: string;
  availability?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface MpAnalyticsDaily {
  date: string;
  total: number;
  completed: number;
  no_partner: number;
}

export interface MpAnalyticsTopService {
  title: string;
  bookings: number;
}

export interface MpAnalyticsTotals {
  bookings: number;
  completed: number;
  no_partner: number;
  cancelled: number;
  completion_rate: number;
  no_match_rate: number;
  gmv_paise: number;
  gmv_display: string;
}

export interface MpAnalytics {
  days: number;
  totals: MpAnalyticsTotals;
  daily: MpAnalyticsDaily[];
  top_services: MpAnalyticsTopService[];
export interface OpsPartnerCounts {
  online: number;
  busy: number;
  offline: number;
  unavailable: number;
  approved_total: number;
}

export interface OpsBookingCounts {
  dispatching: number;
  active: number;
  unassigned: number;
  scheduled_upcoming: number;
  completed_today: number;
}

export interface OpsActiveBooking {
  id: string;
  code: string;
  status: string;
  customer_name: string | null;
  partner_id: string | null;
  partner_name: string | null;
  live_lat: number | null;
  live_lng: number | null;
  live_fresh_seconds: number | null;
  eta_minutes: number | null;
  dest_lat: number;
  dest_lng: number;
}

export interface OpsDispatchBooking {
  id: string;
  code: string;
  status: string;
  created_at: string;
  waiting_seconds: number;
  offers_count: number;
  current_partner_name: string | null;
}

export interface OpsUnassignedBooking {
  id: string;
  code: string;
  status: string;
  created_at: string;
  waiting_seconds: number;
}

export interface OpsAlert {
  id: string;
  code: string;
  status: string;
  kind: string;
  since_seconds: number | null;
}

export interface OpsOverview {
  generated_at: string;
  partners: OpsPartnerCounts;
  bookings: OpsBookingCounts;
  active: OpsActiveBooking[];
  dispatching: OpsDispatchBooking[];
  unassigned: OpsUnassignedBooking[];
  alerts: OpsAlert[];
}

export interface OpsMapPartner {
  id: string;
  name: string | null;
  availability: string;
  lat: number;
  lng: number;
  is_live: boolean;
}

export interface OpsMapDestination {
  code: string;
  lat: number;
  lng: number;
  status: string;
}

export interface OpsMap {
  center_lat: number | null;
  center_lng: number | null;
  partners: OpsMapPartner[];
  destinations: OpsMapDestination[];
}

export interface RefundRow {
  id: string;
  booking_code: string | null;
  amount_paise: number;
  amount_display: string;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
export interface SystemHealth {
  status: string;
  generated_at: string;
  database: { status: string; dialect: string };
  counters: {
    customers: number;
    pandits_total: number;
    pandits_approved: number;
    pandits_online: number;
    bookings_total: number;
    bookings_active: number;
    bookings_dispatching: number;
    bookings_no_partner: number;
    reviews: number;
    open_tickets: number;
    payments: number;
  };
  config: {
    environment: string;
    is_production: boolean;
    geo_backend: string;
    storage_backend: string;
    media_storage_backend: string;
    commission_percent: number;
    gateway_fee_percent: number;
    cors_origins: number;
    docs_enabled: boolean;
    supabase_kyc_configured: boolean;
    supabase_media_configured: boolean;
    revalidate_configured: boolean;
  };
  warnings: string[];
}

const BASE = "/api/v1/mp/admin";

export const mpApi = {
  dashboard: () => api.get<MpDashboard>(`${BASE}/dashboard`),
  analytics: (days = 30) => api.get<MpAnalytics>(`${BASE}/analytics?days=${days}`),
  pandits: (status?: string) =>
    api.get<PanditAdmin[]>(`${BASE}/pandits${status ? `?status=${status}` : ""}`),
  pandit: (id: string) => api.get<PanditDetail>(`${BASE}/pandits/${id}`),
  decide: (
    id: string,
    decision:
      | "approve"
      | "reject"
      | "request_changes"
      | "suspend"
      | "schedule_interview"
      | "complete_interview"
      | "require_reverification",
    reason: string,
  ) =>
    api.post<PanditDetail>(`${BASE}/pandits/${id}/verification-decision`, {
      decision,
      reason,
    }),
  panditDocuments: (id: string) =>
    api.get<VerificationDocument[]>(`${BASE}/pandits/${id}/documents`),
  // Same-origin BFF URL for a private KYC file (cookie auth attached by the
  // proxy). Fetch it as a blob behind a user click — never embed as a src.
  panditDocumentFileUrl: (id: string, docId: string) =>
    `/api/backend${BASE}/pandits/${id}/documents/${docId}/file`,
  bookings: (status?: string) =>
    api.get<BookingAdmin[]>(`${BASE}/bookings${status ? `?status=${status}` : ""}`),
  booking: (id: string) => api.get<BookingDetail>(`${BASE}/bookings/${id}`),
  reassign: (id: string, pandit_id: string, reason: string) =>
    api.post<BookingAdmin>(`${BASE}/bookings/${id}/reassign`, { pandit_id, reason }),

  // Finance
  financeSummary: () => api.get<FinanceSummary>(`${BASE}/finance/summary`),
  payments: () => api.get<Payment[]>(`${BASE}/finance/payments`),
  paymentLedger: (id: string) =>
    api.get<LedgerEntryRow[]>(`${BASE}/finance/payments/${id}/ledger`),
  refund: (id: string, reason: string, amount_paise?: number) =>
    api.post<Payment>(`${BASE}/finance/payments/${id}/refund`, {
      reason,
      amount_paise,
    }),
  payoutsDue: () => api.get<PayoutDue[]>(`${BASE}/finance/payouts`),
  processPayout: (pandit_id: string) =>
    api.post<{ amount_display: string }>(`${BASE}/finance/payouts`, { pandit_id }),

  // Reviews
  reviews: (params: { reported?: boolean; hidden?: boolean; rating?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.reported !== undefined) qs.set("reported", String(params.reported));
    if (params.hidden !== undefined) qs.set("hidden", String(params.hidden));
    if (params.rating !== undefined) qs.set("rating", String(params.rating));
    const s = qs.toString();
    return api.get<Review[]>(`${BASE}/reviews${s ? `?${s}` : ""}`);
  },
  moderateReview: (id: string, hidden: boolean) =>
    api.post<Review>(`${BASE}/reviews/${id}/moderate`, { hidden }),

  // Support
  supportMetrics: () => api.get<SupportMetrics>(`${BASE}/support/metrics`),
  tickets: (status?: string) =>
    api.get<Ticket[]>(`${BASE}/support/tickets${status ? `?status=${status}` : ""}`),
  ticket: (id: string) => api.get<TicketDetail>(`${BASE}/support/tickets/${id}`),
  assignTicket: (id: string) =>
    api.post<TicketDetail>(`${BASE}/support/tickets/${id}/assign`, {}),
  replyTicket: (id: string, body: string) =>
    api.post<TicketDetail>(`${BASE}/support/tickets/${id}/reply`, { body }),
  ticketStatus: (id: string, status: string, resolution?: string) =>
    api.post<TicketDetail>(`${BASE}/support/tickets/${id}/status`, {
      status,
      resolution,
    }),

  // Audit log + permissions (super-admin)
  auditLog: (params: AuditListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.action) qs.set("action", params.action);
    if (params.entity) qs.set("entity", params.entity);
    if (params.actor) qs.set("actor", params.actor);
    if (params.q) qs.set("q", params.q);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 50));
    return api.get<AuditLogList>(`${BASE}/audit?${qs.toString()}`);
  },
  auditMeta: () => api.get<AuditMeta>(`${BASE}/audit/meta`),
  auditPermissions: () => api.get<PermissionMatrix>(`${BASE}/audit/permissions`),
  // Customers CRM
  customers: (params: CustomerListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
  // Partner management (360)
  partners: (params: PartnerListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.availability) qs.set("availability", params.availability);
    if (params.sort) qs.set("sort", params.sort);
    if (params.order) qs.set("order", params.order);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 25));
    return api.get<CustomerList>(`${BASE}/customers?${qs.toString()}`);
  },
  customer: (id: string) => api.get<CustomerDetail>(`${BASE}/customers/${id}`),
  customerBookings: (id: string) =>
    api.get<CustomerBooking[]>(`${BASE}/customers/${id}/bookings`),
  customerPayments: (id: string) =>
    api.get<Payment[]>(`${BASE}/customers/${id}/payments`),
  customerReviews: (id: string) =>
    api.get<Review[]>(`${BASE}/customers/${id}/reviews`),
  customerTickets: (id: string) =>
    api.get<Ticket[]>(`${BASE}/customers/${id}/tickets`),
  customerActivity: (id: string) =>
    api.get<CustomerActivity[]>(`${BASE}/customers/${id}/activity`),
  updateCustomer: (id: string, body: { name?: string; language?: string }) =>
    api.patch<CustomerDetail>(`${BASE}/customers/${id}`, body),
  suspendCustomer: (id: string, reason: string) =>
    api.post<CustomerDetail>(`${BASE}/customers/${id}/suspend`, { reason }),
  reactivateCustomer: (id: string, reason: string) =>
    api.post<CustomerDetail>(`${BASE}/customers/${id}/reactivate`, { reason }),
    return api.get<PartnerList>(`${BASE}/partners?${qs.toString()}`);
  },
  partnerOverview: (id: string) =>
    api.get<PartnerOverview>(`${BASE}/partners/${id}/overview`),
  partnerBookings: (id: string) =>
    api.get<PartnerBookingRow[]>(`${BASE}/partners/${id}/bookings`),
  partnerReviews: (id: string) =>
    api.get<Review[]>(`${BASE}/partners/${id}/reviews`),
  partnerEarnings: (id: string) =>
    api.get<PartnerEarningsDetail>(`${BASE}/partners/${id}/earnings`),
  // Live Operations Centre
  opsOverview: () => api.get<OpsOverview>(`${BASE}/ops/overview`),
  opsMap: () => api.get<OpsMap>(`${BASE}/ops/map`),
  // Finance reporting & reconciliation
  reconciliation: (days = 30) =>
    api.get<Reconciliation>(`${BASE}/finance/reconciliation?days=${days}`),
  ledgerFeed: (entryType?: string, page = 1) => {
    const qs = new URLSearchParams();
    if (entryType) qs.set("entry_type", entryType);
    qs.set("page", String(page));
    qs.set("page_size", "50");
    return api.get<LedgerFeed>(`${BASE}/finance/ledger?${qs.toString()}`);
  },
  financeRefunds: () => api.get<RefundRow[]>(`${BASE}/finance/refunds`),
  // System health
  systemHealth: () => api.get<SystemHealth>(`${BASE}/system/health`),
};
