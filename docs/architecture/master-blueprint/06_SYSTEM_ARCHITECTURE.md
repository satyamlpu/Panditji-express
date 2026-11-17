# 06 — System Architecture

## Topology (current, verified) — a modular monolith
```
                 ┌──────────────────────────────────────────┐
  Customers ───▶ │  Next.js (Vercel) — panditjiexpress.com   │
  (web)          │  • public (site) pages (SSG/ISR)          │
                 │  • /admin console (CSR + React Query)     │
                 │  • BFF proxy /api/backend/[...path]       │
                 └───────────────┬──────────────────────────┘
                                 │ HTTPS /api/v1/*
  Customer app ───┐              ▼
  Partner app  ───┼────▶ ┌──────────────────────────────────────┐
  (Expo, [PARTIAL])      │ FastAPI modular monolith (Vercel)    │
                         │  app.main → routers → domain modules │
                         │  SQLAlchemy 2 async                   │
                         └───────────────┬──────────────────────┘
                                         │ psycopg3 (pooler :6543)
                                         ▼
                              ┌─────────────────────┐
                              │ PostgreSQL (Supabase)│  + PostGIS
                              └─────────────────────┘
```
Sentry (backend + web) is wired but **[PARTIAL]** (no DSN). Rate-limit store, queue,
object storage, push transport are **[MISSING / PROPOSED]** (see 10/14/15/17).

## Boundaries
- **Edge/web (Vercel):** rendering, caching, BFF proxy, security headers.
- **API (Vercel serverless, FastAPI):** all business logic, authz, persistence.
  Serverless specifics handled: `NullPool`, psycopg `prepare_threshold=None` on the
  Supabase transaction pooler.
- **Data (Supabase Postgres):** single source of truth; append-only ledger + audit.

## Layering inside the monolith (verified)
```
routers/            HTTP boundary (validation, authz deps, serialization)
  api/routers/*     content/CMS + base auth + public
  marketplace/routers/*  auth, customer, pandit, discovery, admin(+finance/support), payments
domain modules/     business logic (no HTTP)
  marketplace/{dispatch,finance,otp,geo,eta,notify,support,principals,...}
  services/{audit,auth_service,money,revalidate,slugs}
models/             SQLAlchemy ORM (api `models/*`, marketplace `models.py`)
core/               config, security, errors, middleware, ratelimit, observability
db/                 engine/session, base, types
```
**Dependency rule:** routers → domain → models/core. Domain modules must not import
routers. **[NEEDS-VALIDATION]** — no enforced import-linter yet; add one (see 19).

## Request lifecycle (money path example — booking + pay)
1. `POST /mp/customer/bookings` → `require` customer principal → rate-limit → validate →
   `create_booking` → dispatch offers (TTL 60s).
2. Pandit accepts (`/mp/partner/...accept`) → atomic row-lock assign.
3. `POST /mp/customer/bookings/{id}/pay` → mock order → **signed** webhook → `record_paid`
   posts ledger (charge/fee/commission/partner_payable) idempotently.
4. Status advances → `completed` → review enabled → payout eligible.

## Target architecture (staged, additive) [PROPOSED]
- **Keep the monolith**; extract a service only with measured evidence (rule #14).
- Add **Redis** (rate-limit, cache, locks, ephemeral presence), **durable queue +
  outbox** (notifications, scheduled dispatch, webhooks), **object storage** (KYC docs,
  media) with short-lived signed URLs, **realtime channel** (tracking), **read
  replica** + **partitioning** for high-volume tables (events, tracking, ledger).
- **Outbox pattern** for all external effects (SMS, push, payment, email) to make them
  idempotent and retryable.

## Cross-cutting concerns
| Concern | Current | Target |
|---|---|---|
| AuthN | JWT HS256 (15m access / 7d refresh rotation) [IMPLEMENTED] | + device sessions, admin MFA |
| AuthZ | deny-by-default, DB-resolved roles [IMPLEMENTED] | + ABAC (object/amount/geo/team) |
| Rate limit | pluggable (Redis/Upstash/in-proc), fail-open [IMPLEMENTED] | shared store in prod |
| Idempotency | webhook idempotent; ledger idempotent [PARTIAL] | idempotency keys on all money POSTs |
| Observability | Sentry wired [PARTIAL] | logs+traces+metrics, DSN set |
| Config/secrets | pydantic-settings + prod guard [IMPLEMENTED] | secret manager + rotation |

## Non-goals (now)
Microservices, event-sourcing, multi-region active-active, sharding — none justified by
measured load yet (rule #14). Revisit per 17.
