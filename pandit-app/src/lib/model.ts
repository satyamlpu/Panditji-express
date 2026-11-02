// Shared domain types mirroring the backend marketplace schemas, plus small
// helpers the Pandit Partner screens reuse.

export interface Capability {
  service_id: string;
  slug: string;
  title: string;
}

export interface Pandit {
  id: string;
  phone: string;
  name: string | null;
  languages: string[] | null;
  city: string | null;
  status: string; // draft | submitted | under_review | action_required | approved | rejected | suspended
  availability: string; // offline | online | busy | unavailable
  base_lat: number | null;
  base_lng: number | null;
  service_radius_km: number;
  rating_avg: number | null;
  rating_count: number;
  capabilities: Capability[];
}

export interface Offer {
  booking_id: string;
  code: string;
  service_title: string;
  address_line: string;
  landmark: string | null;
  dest_lat: number;
  dest_lng: number;
  distance_km: number | null;
  price_display: string;
  offered_at: string;
  expires_at: string;
}

export interface Booking {
  id: string;
  code: string;
  status: string;
  service_title: string;
  price_display: string;
  mode: string;
  scheduled_at: string | null;
  address_line: string;
  landmark: string | null;
  dest_lat: number;
  dest_lng: number;
  created_at: string;
  confirmed_at: string | null;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  booking_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Service {
  slug: string;
  title: string;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
}

// Booking states where a partner is committed and actively working.
export const ACTIVE_STATES = ["confirmed", "en_route", "arrived", "in_progress"];
export const TERMINAL_STATES = [
  "completed",
  "expired",
  "no_partner_available",
  "rejected",
  "cancelled_customer",
  "cancelled_partner",
  "cancelled_platform",
];

// Linear status chain the partner advances through (matches dispatch._NEXT).
const NEXT: Record<string, { to: string; label: string }> = {
  confirmed: { to: "en_route", label: "Start travelling" },
  en_route: { to: "arrived", label: "I've arrived" },
  arrived: { to: "in_progress", label: "Start the puja" },
  in_progress: { to: "completed", label: "Mark completed" },
};
export const nextStep = (status: string) => NEXT[status] ?? null;

// Languages offered for onboarding (demo set for the Kanpur launch region).
export const LANGUAGES = ["Hindi", "Sanskrit", "English", "Awadhi", "Bhojpuri", "Maithili"];

// Demo base location (Kanpur centre). A production app reads this from GPS.
export const KANPUR = { lat: 26.4499, lng: 80.3319 };

export function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
