# Pandit Ji Express — Current System Audit

_Audit date: 2026-11-20. Branch audited: `main` (PRs #1–#7 merged). Read-only audit; no code was changed._

**Classification legend**
| Tag | Meaning |
|---|---|
| ✅ **Verified** | Implemented and backed by a passing automated test (CI/PostgreSQL) or executed live this session |
| 🟢 **Unverified** | Implemented in code, compiles/builds, but no automated test or live run proves behavior |
| 🟡 **Partial** | Some of the capability exists; notable parts missing |
| ⚪ **Missing** | Not implemented |
| 🔴 **Broken** | Present but failing |
| ⛔ **Blocked** | Implemented up to a seam; completion needs an external credential/infra/business decision |

> "Verified" here means **test or live evidence**, not production-readiness. There is **no load-test evidence**, so no scale claim is verified (see §9).

---

## 0. Repository structure

```
backend/        FastAPI + SQLAlchemy 2 async + Alembic (Python 3.14)
  app/
    api/routers/        website/CMS + auth + admin CMS endpoints
    marketplace/        the app/CRM domain (routers, models, dispatch, finance, storage…)
    core/               config, security, ratelimit, errors
    db/                 session (engine/pool), base
    models/, services/  shared models + audit/money helpers
  alembic/versions/     9 migrations
  tests/                13 files, 67 tests
frontend/       Next.js 15 App Router (admin CRM + public site), React 19, Tailwind
customer-app/   Expo SDK 58 / expo-router / RN 0.88 (customer mobile)
pandit-app/     Expo SDK 58 / expo-router / RN 0.88 (partner mobile)
docs/           architecture blueprint (27), audits (40), mobile (4)
.github/workflows/  ci.yml, backup.yml
```

Environments: dev (SQLite, no external services — `backend/.env.example`), CI (PostgreSQL+PostGIS service), prod (Vercel ×2 + Supabase Postgres).

---

## 1. Backend — domain & data

| Area | Status | Evidence |
|---|---|---|
| Data model — 31 tables | ✅ | `backend/app/marketplace/models.py`, `backend/app/models/*.py` |
| Alembic chain (9 migrations) on PostgreSQL | ✅ | CI step "Migrate (alembic upgrade head)" in `.github/workflows/ci.yml`; validated base→head + downgrade this session |
| Booking state machine (10 states + terminals) | ✅ | `app/marketplace/constants.py:75` `BookingStatus`; `test_full_lifecycle_to_completed` |
| Staff roles (6: ops/verification/finance/support/marketing/admin) | ✅ enforcement | `app/marketplace/constants.py:14` `StaffRole`; `app/marketplace/principals.py:116` `require_staff` |
| Append-only audit log w/ actor + verified IP | ✅ | `app/services/audit.py`; `test_marketplace_audit.py` (4 tests) |

---

## 2. Backend — API surface (by router)

| Router | Routes | Status | Test evidence |
|---|---|---|---|
| `marketplace/routers/customer.py` | 18 | ✅ | `test_marketplace.py`, `test_marketplace_tracking.py` |
| `marketplace/routers/pandit.py` | 18 | ✅ | `test_marketplace.py`, `test_marketplace_verification.py` |
| `marketplace/routers/admin.py` | 9 | ✅ | `test_marketplace.py` (verify/reassign/bookings), `test_marketplace_verification.py` |
| `marketplace/routers/admin_finance.py` | 8 | ✅ | `test_marketplace_finance.py`, `test_marketplace_concurrency.py` |
| `marketplace/routers/admin_support.py` | 5 | ✅ | `test_marketplace_support.py` |
| `marketplace/routers/discovery.py` | 3 | 🟢 | exercised indirectly via booking tests; no dedicated test |
| `marketplace/routers/payments.py` | 2 | ⛔ | mock gateway; `test_marketplace_finance.py::test_payment_requires_signed_webhook` verifies the webhook trust boundary, not a real PSP |
| `marketplace/routers/auth.py` (OTP) | 2 | 🟡 | logic tested via `_token` helper in marketplace tests; **dev-only OTP** (no SMS) |
| `api/routers/public.py` | 14 | ✅ | `test_public.py` (4) |
| `api/routers/admin_services.py` | 5 | ✅ | `test_services_admin.py` (4) |
| `api/routers/admin_pages/categories/locations/testimonials/faqs/banners/enquiries/settings` | 2–6 each | ✅/🟢 | `test_content.py`, `test_enquiries.py` |
| `api/routers/admin_media.py` | 1 | 🟡 | `test_content.py::test_media_rejects_non_image` (validation only; no real object store) |
| `api/routers/auth.py` (admin) | 5 | ✅ | `test_auth.py` (6) |

---

## 3. Flagship flows

| Flow | Status | Evidence |
|---|---|---|
| OTP auth (customer & partner) | 🟡 works, dev-only | `app/marketplace/routers/auth.py`; `dev_code` returned when not production (`auth.py:47`). Real SMS ⛔. |
| Admin auth + refresh + change-password | ✅ | `test_auth.py` |
| Authorization (per-kind JWT, role gate) | ✅ | `principals.py` `create_principal_token`/`require_staff`; `test_marketplace.py::test_admin_bookings_require_staff`, `test_marketplace_finance.py::test_finance_requires_staff` |
| Discovery / search | 🟢 | `discovery.py` |
| Booking create → dispatch → confirm | ✅ | `test_booking_offers_nearest_and_confirms` |
| Dispatch matching (nearest eligible) | ✅ | `dispatch.py` `_rank_candidates`; haversine (dev) + **PostGIS `ST_DWithin` + GiST index** (`test_marketplace_geo_postgis.py`) |
| Concurrency safety (no double-assign/pay) | ✅ | `dispatch.py` `with_for_update` (`accept_offer`:325); `test_marketplace_concurrency.py` (9: parallel double-accept→one winner, duplicate webhook→single ledger, refund caps, double payout→pays once) |
| Offer expiry → next → no-partner | ✅ | `test_expired_offer_advances_to_no_partner` |
| Cancel frees partner / reassign | ✅ | `test_cancel_frees_partner`, `test_admin_manual_reassign` |
| Full lifecycle to completed | ✅ | `test_full_lifecycle_to_completed` |
| Live location + ETA + freshness | ✅ | `test_marketplace_tracking.py` (5) — basic ping/ETA, not a realtime stream |
| Payments + ledger (charge/commission/fee/payable/refund/payout) | 🟡 ledger ✅ / gateway ⛔ | `finance.py`; `test_marketplace_finance.py`. Mock gateway — real PSP pending |
| Webhook signature + idempotency | ✅ | `test_payment_requires_signed_webhook`, `test_webhook_idempotent` |
| Refunds (reason + cap) / payouts | ✅ | `test_refund_requires_reason_and_caps`, `test_payout_flow` |
| Reviews (only on completed, once) | ✅ | `test_review_only_on_completed_and_once` |
| Support tickets (both apps + admin, scoped) | ✅ | `test_marketplace_support.py` (4) |
| **Pandit KYC: submit → review → approve** | ✅ | `test_marketplace_verification.py` (5) + live walk this session |
| **KYC private file upload + gated admin download** | ✅ code / ⛔ prod storage | `app/marketplace/storage.py`, `pandit.py` submit, `admin.py` file route; tests upload→download(bytes)→approve + 415/413/404/auth. Prod needs Supabase bucket + migration (⛔). |
| In-app notifications | ✅ | `test_marketplace_tracking.py::test_notifications_emitted` |
| Push notification delivery (FCM/APNs) | ⚪/⛔ | `app/marketplace/push.py` is **token registry only** — no send implementation |
| Suspended-pandit lockout | ✅ | `test_marketplace_concurrency.py::test_suspended_pandit_loses_api_access` |

---

## 4. Admin CRM (frontend) — `frontend/src/app/admin/`

Route groups (Control Center + Website + App/CRM) — structure implemented.

| Section | Status | Path |
|---|---|---|
| Control Center (live counts) | 🟢 | `admin/(center)/page.tsx` |
| Website: Services (+new/edit), Categories, Locations, Testimonials, FAQs, Pages, Homepage, Enquiries, Settings | 🟢 | `admin/(website)/…` |
| Website: **Media Library** | 🟡 placeholder | `admin/(website)/media/page.tsx` (19 lines, EmptyState) |
| Website: **SEO** | 🟡 placeholder | `admin/(website)/seo/page.tsx` (19 lines, EmptyState) |
| App/CRM: Operations, Partners (+KYC docs + **View file**), Bookings (+detail/timeline), Finance, Reviews, Support, Customers | 🟢 | `admin/(app)/marketplace/…` |
| Premium design pass (MetricCard, SVG charts) | 🟡 | `frontend/src/components/admin/kit.tsx`, `charts.tsx` |

> Frontend is **build/typecheck/lint-verified** (CI `frontend` job) but has **no automated functional/e2e tests**, so behavior is 🟢 unverified by tests.

---

## 5. Public website — `frontend/src/app/(site)/`

🟢 Implemented (build-verified): Home, About, How-it-works, Puja services (list+detail), Categories (detail), Locations (list+detail), Testimonials, FAQs, Contact, Book (`/book/[slug]`), legal pages. Backend public API ✅ (`test_public.py`, sitemap/draft exclusion).

---

## 6. Mobile apps

Shared foundation (both): env API base + timeout + GET retry (`src/lib/api.ts`), SecureStore + AsyncStorage fallback (`storage.ts`), hi/en i18n, offline banner, Sentry (DSN-gated).

| App | Screens | Status |
|---|---|---|
| **Customer** (`customer-app/src/app`) | Home, Bookings, Booking detail (tracking), Notifications, Profile, Addresses, Book, Login(OTP), Support, Ticket | 🟢 tsc+lint-verified, Expo-web run |
| **Partner** (`pandit-app/src/app`) | Home, Jobs, Earnings, Profile, Login(OTP), Onboard, Job detail, Notifications, Support, Ticket, **Verification (+photo upload)** | 🟢 tsc+lint-verified, Expo-web run |

⚪ **No native store builds** (EAS) and **no RN test suite**. Native modules (e.g. `expo-image-picker`) require a dev/EAS build, not Expo Go.

---

## 7. Auth / authorization (detail)

- Per-principal JWT with a `kind` claim (`customer`/`pandit`/`staff`) — `principals.py:36` `create_principal_token`, decoded by `_claims` with `expected_kind`. ✅
- Admin access tokens (15-min) + refresh (7-day httpOnly cookie) via BFF proxy — `frontend/src/app/api/backend/[...path]/route.ts` (transparent refresh). 🟢
- Staff RBAC **enforced server-side** per endpoint via `require_staff(*roles)` (`principals.py:116`), super-admin always allowed. ✅ enforcement; ⚪ **no admin role-management UI**; roles set on `admin_user.role` directly.
- OTP stored as HMAC-SHA256 (pepper or JWT secret) — `app/marketplace/otp.py`. ✅
- Production secret-guard refuses boot on default JWT/webhook/revalidate secrets — `app/core/config.py` `validate_runtime`. ✅

---

## 8. CI/CD, security, deployment config

| Item | Status | Evidence |
|---|---|---|
| CI backend: ruff → alembic upgrade head (PostGIS 16-3.4) → pytest | ✅ | `.github/workflows/ci.yml` |
| CI frontend: lint → typecheck → build | ✅ | same; ⚠️ intermittent `next/font` flake (passes on Vercel + re-run) |
| Branch protection on `main` (both checks required) | ✅ | added 2026-11-20 |
| Deploy backend (Vercel `@vercel/python`) | 🟢 | `backend/vercel.json` |
| Deploy frontend (Vercel, Supabase) | 🟢 | live `panditjiexpress.com` |
| **Migrations auto-run on deploy** | ⚪ **No** | no build hook; must apply to prod Supabase by hand (`docs/prod-migration-kyc-files.md`) |
| Scheduled DB backup | 🔴 **Broken** | `.github/workflows/backup.yml` runs failed 2026-11-19 & -20 |
| Secret hygiene (no secrets in repo) | ✅ | `.env.example` holds only placeholders |
| Rate limiting (Redis/Upstash/in-process) | 🟡 | `app/core/ratelimit.py` — in-process default is single-instance only |

---

## 9. Scalability signals (toward 10M users)

| Signal | State | Evidence / risk |
|---|---|---|
| DB pooling | 🟢 | `app/db/session.py`: NullPool on serverless + pooled (pgbouncer) endpoint; bounded pool (size 10) on long-lived server |
| Rate limiter | 🟡 | in-process default is **not** shared across instances — prod must set `REDIS_URL`/Upstash or limits are per-instance |
| Pagination | 🟡 | limit/offset present in 7 routers; **not uniformly enforced** on every list — needs a pass before large tables |
| Geo matching | ✅ scalable path | PostGIS `ST_DWithin` + GiST index (`geo_backend=postgis`); haversine is O(n) dev-only |
| Concurrency correctness under load | ✅ | row locks + partial unique indexes proven by `test_marketplace_concurrency.py` |
| Caching / CDN | ⚪ | no app-level cache layer; Next.js ISR used for content |
| **Load / stress testing** | ⚪ **None** | no evidence — **10M-user capacity is unproven** |
| Background jobs / queue | ⚪ | dispatch expiry is `tick()`-driven, not a durable scheduler/queue |

---

## 10. Architecture summary

A **modular-monolith FastAPI backend** (one Postgres) serves four clients (public web, admin CRM, customer app, partner app). The marketplace domain (booking, dispatch, finance, verification, support) is cohesive, **concurrency-safe** (row locks + unique indexes, proven in CI on real Postgres), and **security-hardened** (per-kind JWT, server-side RBAC, audit log, secret-guard, signed webhooks). The core business flows are implemented and test-backed end to end. The gaps are concentrated at **external seams** (SMS, payment PSP, push) and **production enablement/ops** (migrations-on-deploy, KYC storage, backup workflow, load testing), plus two admin placeholders (Media, SEO) and the absence of mobile store builds and frontend/mobile test suites.

See `INTEGRATION-GAP-ANALYSIS.md` for the seams and `PRODUCTION-ROADMAP.md` for sequencing.
