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
  capabilities: CapabilityRef[];
}

export interface PanditBrief {
  id: string;
  name: string | null;
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

export interface TicketDetail extends Ticket {
  resolution: string | null;
  messages: TicketMessage[];
}

const BASE = "/api/v1/mp/admin";

export const mpApi = {
  dashboard: () => api.get<MpDashboard>(`${BASE}/dashboard`),
  pandits: (status?: string) =>
    api.get<PanditAdmin[]>(`${BASE}/pandits${status ? `?status=${status}` : ""}`),
  pandit: (id: string) => api.get<PanditDetail>(`${BASE}/pandits/${id}`),
  decide: (
    id: string,
    decision: "approve" | "reject" | "request_changes" | "suspend",
    reason: string,
  ) =>
    api.post<PanditDetail>(`${BASE}/pandits/${id}/verification-decision`, {
      decision,
      reason,
    }),
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
  reviews: () => api.get<Review[]>(`${BASE}/reviews`),
  moderateReview: (id: string, hidden: boolean) =>
    api.post<Review>(`${BASE}/reviews/${id}/moderate`, { hidden }),

  // Support
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
};
