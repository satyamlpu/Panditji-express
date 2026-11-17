# 08 — API Contracts

All endpoints are versioned under `/api/v1`. Inventory below is the **actual current
surface** (verified from `@router` decorators). AuthZ column: `public`, `customer`,
`pandit`, `admin:<role>` (role-scoped staff), `super-admin` (content).

## Conventions (current + target)
- **Versioning:** `/api/v1/...`. New breaking shapes → `/api/v2`; deprecate via header +
  inventory (target; no deprecation policy yet [MISSING]).
- **Auth:** Bearer JWT (access 15m). Refresh via `/api/v1/auth/refresh` (rotation). OTP
  for mobile principals.
- **Errors:** standard envelope with `code` + message (`APIError`); verbose bodies off
  in prod (`validate_runtime`). Codes seen: `rate_limited`, `invalid_amount`,
  `reason_required`, `not_eligible`, `nothing_due`, `conflict`.
- **Rate limiting:** on login, OTP request, booking create, enquiry. Pluggable store.
- **Idempotency:** payment webhook is idempotent; **target:** `Idempotency-Key` header on
  all money-mutating POSTs (booking create, pay, refund, payout) [PROPOSED].
- **Pagination:** list endpoints currently return arrays; **target:** cursor pagination
  on high-volume lists (bookings, payments, notifications) [PROPOSED].
- **Output allowlist:** responses are Pydantic `response_model` (no raw ORM leakage).

## Public content — `/api/v1/public` [IMPLEMENTED]
`GET /services`, `GET /services/{slug}`, `GET /categories`, `GET /categories/{slug}`,
`GET /locations`, `GET /locations/{slug}`, `GET /homepage`, `GET /testimonials`,
`GET /faqs`, `GET /pages/{slug}`, `GET /settings`, `GET /sitemap`, `GET /redirects`,
`POST /enquiries` (rate-limited). AuthZ: public.

## Base auth — `/api/v1/auth` [IMPLEMENTED]
`POST /login` (admin, rate-limited), `POST /refresh`, `GET /me`, `POST /logout`.

## Content admin — `/api/v1/admin/*` [IMPLEMENTED] — AuthZ: **super-admin** (`require_admin`)
Per resource (banners, categories, enquiries, faqs, locations, media, pages, services,
settings, testimonials): `GET ""`, `POST ""`, `GET/PATCH/DELETE /{id}` (resource-
dependent; enquiries read+patch only; media POST only; settings `GET`+`PUT /{key}`;
locations also `PUT /{id}/services`). Every mutation writes `audit_log`.

## Marketplace auth — `/api/v1/mp/auth` [IMPLEMENTED]
`POST /otp/request` (rate-limited), `POST /otp/verify` → principal token. `dev_code`
only in non-prod.

## Customer — `/api/v1/mp/customer` [IMPLEMENTED] — AuthZ: customer (ownership-scoped)
`GET/PATCH /profile`; `GET/POST /addresses`; `POST /bookings` (rate-limited),
`GET /bookings`, `GET /bookings/{id}`, `GET /bookings/{id}/events`,
`GET /bookings/{id}/tracking`, `POST /bookings/{id}/pay`, `POST /bookings/{id}/review`,
`POST /bookings/{id}/cancel`; `GET /notifications`, `POST /notifications/read-all`;
`POST/GET /support/tickets`, `GET /support/tickets/{id}`, `POST /support/tickets/{id}/reply`.

## Partner — `/api/v1/mp/partner` [IMPLEMENTED] — AuthZ: pandit (APPROVED gate)
`GET /profile`, `POST /onboard`, `PATCH /availability`, `POST /heartbeat`,
`GET /booking-requests`, `POST /booking-requests/{id}/accept|reject`,
`GET /bookings`, `POST /bookings/{id}/status`, `POST /location`,
`GET /notifications`, `POST /notifications/read-all`, support ticket endpoints.

## Discovery — `/api/v1/mp/discovery` [IMPLEMENTED] — AuthZ: public/customer
`GET /services`, `GET /pandits`, `GET /serviceability`.

## Marketplace admin — `/api/v1/mp/admin` [IMPLEMENTED]
- Ops/verification (`admin.py`): `GET /pandits`, `GET /pandits/{id}`,
  `POST /pandits/{id}/verification-decision` (verification), `GET /bookings`,
  `GET /bookings/{id}`, `POST /bookings/{id}/reassign` (ops), `GET /dashboard` (ops).
- Finance (`admin_finance.py`, role=finance): `GET /finance/summary`,
  `GET /finance/payments`, `GET /finance/payments/{id}/ledger`,
  `POST /finance/payments/{id}/refund`, `GET/POST /finance/payouts`; reviews
  (role=support): `GET /reviews`, `POST /reviews/{id}/moderate`.
- Support (`/api/v1/mp/admin/support`, role=support): `GET /tickets`,
  `GET /tickets/{id}`, `POST /tickets/{id}/assign|reply|status`.

## Payments — `/api/v1/mp/payments` [PARTIAL / DEV]
`POST /webhooks/mock` (HMAC-signed), `POST /mock/pay`. **Real gateway integration is
[MISSING]** — replace mock with provider order + verified webhook + idempotency.

## Contract gaps for the apps [PROPOSED]
- Realtime/tracking channel contract (WS/SSE) — currently HTTP poll only.
- Push-registration endpoint (device token) — [MISSING].
- Reschedule, add-ons, coupons, invoice, account-deletion endpoints — [MISSING].
- OpenAPI published + contract tests (FastAPI auto-generates `/openapi.json`; publish +
  snapshot test it).
