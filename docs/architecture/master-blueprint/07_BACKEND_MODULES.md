# 07 — Backend Modules

For each module: responsibilities, interfaces, DB ownership, authz, failure modes,
dependencies, test strategy. Modules marked by the actual files that implement them.

## Legend
Ownership = tables the module writes. Pub = HTTP router; Int = internal domain module.

## Identity & Authentication [IMPLEMENTED]
- **Files:** `app/api/deps.py`, `app/marketplace/principals.py`, `app/core/security.py`,
  `app/services/auth_service.py`, `app/api/routers/auth.py`, `app/marketplace/routers/auth.py`,
  `app/marketplace/otp.py`.
- **Responsibilities:** admin email/password login; customer/pandit phone+OTP; JWT
  issue/verify (HS256, access 15m, refresh 7d with rotation+revocation); OTP issue/verify
  (HMAC-SHA256 keyed+phone-bound, single-use, TTL 5m, 5 attempts).
- **Owns:** `admin_user`, `refresh_token`, `mp_otp_code`.
- **AuthZ:** n/a (establishes principals).
- **Failure modes:** invalid/expired token→401; suspended→403; OTP replay→reject;
  OTP infra (SMS) missing in prod → **[BLOCKED]** real mobile login.
- **Tests:** `test_auth.py`, OTP happy-path in `test_marketplace.py`; **gap:** OTP
  hash/pepper/phone-binding assertions.

## Authorization [IMPLEMENTED]
- **Files:** `deps.require_admin`, `principals.require_staff(*roles)`.
- **Model:** deny-by-default; role re-resolved from DB each request; super-admin
  always allowed. **Gap:** object-level/ABAC (see 10). Tests: cross-role 403 **[MISSING]**.

## Customer [IMPLEMENTED]
- **Files:** `marketplace/routers/customer.py`. **Owns:** `mp_customer`,
  `mp_customer_address`. **Pub:** `/mp/customer/*` (profile, addresses, bookings create/
  list/cancel/pay/review). **AuthZ:** customer principal, ownership-scoped.

## Partner [IMPLEMENTED]
- **Files:** `marketplace/routers/pandit.py`. **Owns:** `mp_pandit`,
  `mp_pandit_capability`. **Pub:** `/mp/partner/*` (availability, offers, accept/reject,
  status advance, earnings). **AuthZ:** pandit principal; APPROVED gate.

## Verification / KYC [PARTIAL]
- **Files:** `marketplace/routers/admin.py` (verification_decision). **Owns:**
  `mp_verification_document`. **Gap:** document upload to object storage + signed-URL
  review; penny-drop bank verification [MISSING].

## Catalogue (services/categories/content) [IMPLEMENTED]
- **Files:** `api/routers/admin_services|categories|...`, `public.py`, `services/slugs.py`,
  `revalidate.py`. **Owns:** `service`, `category`, `location`, `service_location`,
  `faq`, `page`, `testimonial`, `banner`, `setting`, `redirect`, `homepage_section`,
  `booking_enquiry`. **AuthZ:** content = `require_admin` (super-admin).

## Pricing [PARTIAL]
- **Files:** `services/money.py`, service `price_paise`, ledger components. **Owns:**
  pricing is derived, not a table. **Gap:** add-ons/coupons/dynamic pricing [MISSING].

## Geography [IMPLEMENTED]
- **Files:** `marketplace/geo.py` (haversine + PostGIS), migration `c3e6a9f1..postgis`.
  **Used by:** dispatch candidate ranking. **Gap:** polygon service zones [MISSING].

## Availability [PARTIAL]
- **Files:** pandit availability + `last_heartbeat`. **Gap:** calendar/scheduled slots.

## Booking [IMPLEMENTED]
- **Files:** `customer.create_booking`, `dispatch.py`. **Owns:** `mp_booking`,
  `mp_booking_event`. **Failure:** no-pandit → fail/scheduled fallback. Idempotency on
  create **[NEEDS-VALIDATION]**.

## Dispatch [IMPLEMENTED]
- **Files:** `marketplace/dispatch.py`, `eta.py`. **Owns:** `mp_dispatch_attempt`.
  Offers ranked nearest-eligible, 60s TTL, atomic accept (row-lock), manual reassign
  (audited). **Gap:** scheduled-dispatch worker; offer-monitoring surface.
- **Tests:** concurrency suite (PG-only) covers double-accept race.

## Payments [PARTIAL / DEV]
- **Files:** `marketplace/routers/payments.py`, `finance.py` (orders, signed mock
  webhook, record_paid). **Owns:** `mp_payment`. **Gap:** real gateway integration.

## Finance / Ledger / Refunds / Payouts [IMPLEMENTED]
- **Files:** `marketplace/finance.py`, `routers/admin_finance.py`. **Owns:**
  `mp_ledger_entry` (append-only), `mp_refund`, `mp_payout`. Refund/payout audited
  (actor_id + IP), transactionally atomic. **Gap:** reconciliation, maker-checker.

## Tracking [PARTIAL]
- **Files:** booking/pandit live-location fields + events (migration `66a529..tracking`).
  **Gap:** realtime transport (WS/SSE/Supabase Realtime) [MISSING].

## Notifications [PARTIAL]
- **Files:** `marketplace/notify.py`. **Owns:** `mp_notification` (in-DB). **Gap:** push
  (FCM/APNs), SMS, email transports + outbox [MISSING].

## Reviews [IMPLEMENTED]
- **Files:** review endpoint + aggregation on pandit. **Owns:** `mp_review`
  (one-per-booking, post-completion).

## Support [IMPLEMENTED]
- **Files:** `marketplace/support.py`, `routers/admin_support.py`. **Owns:**
  `mp_support_ticket`, `mp_ticket_message`. **Gap:** SLA, disputes, escalation.

## Audit [IMPLEMENTED]
- **Files:** `services/audit.py`. **Owns:** `audit_log` (append-only). Broad coverage of
  staff/financial mutations; atomic with the mutation. **Gap:** admin viewer UI.

## CRM / Analytics / Risk / Integrations [MISSING / PARTIAL]
- CRM surfaces are thin (customers directory). Analytics, risk/fraud, and an
  integrations layer (SMS/PG/push/maps/storage adapters) are **[MISSING]** — the single
  largest build area (see 23 roadmap).

## Module dependency summary (no cycles)
```
auth/identity ─▶ (used by) customer, partner, admin, all routers
catalogue ─▶ booking (service snapshot)
geo ─▶ dispatch ; availability ─▶ dispatch
booking ─▶ dispatch ─▶ (assign) ─▶ tracking
payments ─▶ finance(ledger) ─▶ refunds/payouts
every mutation ─▶ audit ; many ─▶ notify
```
