# Pandit Ji Express — Integration & Gap Analysis

_2026-11-20, branch `main`. Companion to `CURRENT-SYSTEM-AUDIT.md`. Read-only; no code changed._

This document lists every **external integration seam** and **capability gap**: what exists today, exactly where it plugs into the code, what is required to finish it (credential / infrastructure / business decision), and its classification.

Classification tags as in the audit (✅ verified, 🟢 unverified, 🟡 partial, ⚪ missing, 🔴 broken, ⛔ blocked-external).

---

## A. External integration seams

### A1. SMS / OTP delivery ⛔
- **Now:** OTP generated + HMAC-stored; in non-prod the code is returned in the response. `backend/app/marketplace/otp.py`, `backend/app/marketplace/routers/auth.py:47` (`dev_code=None if settings.is_production else code`).
- **Seam:** `issue_otp()` is the single place a provider send call belongs; response already hides the code in prod.
- **Needs:** SMS provider account (MSG91 / Gupshup / Twilio) + **DLT template registration** (India regulatory — business decision + ~days of approval) + env keys. No sender today in prod → **users cannot receive OTP in production**.
- **Effort:** S (code) + external lead time for DLT.

### A2. Payment gateway ⛔
- **Now:** mock gateway; full ledger + signed-webhook + idempotency plumbing built. `backend/app/marketplace/payments.py`, `backend/app/marketplace/finance.py` ("A mock gateway stands in for a real provider in dev"). Verified: `test_payment_requires_signed_webhook`, `test_webhook_idempotent`, refund caps, payout.
- **Seam:** order-create + webhook-verify functions; `settings.payment_webhook_secret`, commission/fee percents already configurable.
- **Needs:** Razorpay/PhonePe (or Cashfree) merchant account + API keys + webhook secret; map their payload to the existing verify/idempotency path. Business decisions: PSP choice, settlement cadence, refund policy.
- **Effort:** M.

### A3. Push notifications (FCM / APNs) ⚪
- **Now:** device-token **registry only** (`backend/app/marketplace/push.py`, POST/DELETE `/push-token` on customer+pandit). In-app notifications work (`test_notifications_emitted`). No send path.
- **Seam:** wherever `Notification` rows are created (dispatch offers, status changes) a push dispatch should fan out to registered tokens.
- **Needs:** FCM project (Android) + APNs key (iOS) + a send implementation (Expo Push or direct FCM/APNs). Business decision: Expo Push service vs direct.
- **Effort:** M.

### A4. KYC document storage (production) ⛔
- **Now:** code complete — pluggable storage with `LocalDiskStorage` + `SupabaseStorage`; private, server-generated keys, path-traversal guards, MIME allowlist, size cap, gated audited download. `backend/app/marketplace/storage.py`. Verified by tests + live run.
- **Seam:** `settings.storage_backend` (`local`→`supabase`) + `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`/`SUPABASE_STORAGE_BUCKET`.
- **Needs:** (1) run migration `e1a2b3c4d5f6` on prod Supabase; (2) create a **private** `kyc-private` bucket; (3) set the env. Runbook: `backend/docs/prod-migration-kyc-files.md`. Until done, verification endpoints 500 in prod (Vercel FS is read-only).
- **Effort:** S (ops).

### A5. General media / image storage (admin Media Library) 🟡
- **Now:** admin media route validates image type only (`test_media_rejects_non_image`); UI is a placeholder (`admin/(website)/media/page.tsx`).
- **Seam:** same storage abstraction as A4 can be reused for public media (distinct **public** bucket + CDN).
- **Needs:** object storage bucket (public/CDN) + upload UI + WebP/AVIF transform + usage tracking. Business decision: CDN choice.
- **Effort:** M.

### A6. Maps / geocoding ⚪ (assess)
- **Now:** distance is computed from stored lat/lng (haversine/PostGIS). No external geocoding/routing/map-tiles integration found.
- **Needs (if required):** address→lat/lng geocoding + map tiles for apps (Google Maps/Mapbox) + optional routing ETA. Business decision: provider + cost. Current ETA is a straight-line estimate (`eta.py`).
- **Effort:** M (only if product wants map UI / real routing).

### A7. Transactional email ⚪ (assess)
- **Now:** no email provider found (enquiries stored for admin; no email send).
- **Needs (if required):** email provider (SES/Resend/Sendgrid) for receipts, enquiry acknowledgements, admin alerts. Business decision: whether email is in scope for launch.
- **Effort:** S–M.

### A8. Error monitoring / observability 🟡
- **Now:** Sentry wired, DSN-gated, in backend (`settings.sentry_dsn`) and both apps (`observability.ts`). Off until DSN set.
- **Needs:** Sentry project + DSNs in prod env. No APM/metrics/log-aggregation/uptime beyond Sentry + Vercel.
- **Effort:** S to enable; M for full observability.

### A9. Realtime transport (tracking/offers) 🟡
- **Now:** location + offers are HTTP poll/ping based (`test_marketplace_tracking.py`). No WebSocket/SSE/push-driven realtime.
- **Needs (for live map + instant offers at scale):** a realtime channel (WebSocket service / Supabase Realtime / Ably) — serverless Vercel functions are a poor fit for long-lived sockets. Architectural decision.
- **Effort:** L.

---

## B. Capability gaps (internal)

| Gap | Class | Location | Needed |
|---|---|---|---|
| Admin **Media Library** UI | 🟡 | `admin/(website)/media/page.tsx` | storage (A5) + upload UI |
| Admin **SEO** engine | 🟡 | `admin/(website)/seo/page.tsx` | canonical/OG/sitemap/robots/JSON-LD management (sitemap data already in `public.py`) |
| **RBAC admin UI** | 🟡 | roles enforced (`principals.py`), no UI | screen to assign `admin_user.role`; 8-role model if required |
| **Discovery** dedicated tests | 🟢 | `discovery.py` | add tests |
| **Frontend** functional/e2e tests | ⚪ | `frontend/` | Playwright/RTL suite (build-only today) |
| **Mobile** test suite | ⚪ | `customer-app/`, `pandit-app/` | Jest/RNTL + Detox/Maestro |
| **Mobile store builds** | ⚪ | both apps | EAS build + store listings + native perms config |
| **Scheduled DB backup** | 🔴 | `.github/workflows/backup.yml` | fix failing workflow |
| **Migrations on deploy** | ⚪ | no hook | deploy step or documented manual gate (runbook exists) |
| **Shared rate-limit store** | 🟡 | `app/core/ratelimit.py` | set `REDIS_URL`/Upstash in prod |
| **Load/scale testing** | ⚪ | — | k6/Locust plan + run (see roadmap) |
| **Background job scheduler** | ⚪ | dispatch `tick()` | durable scheduler/queue for offer-expiry at scale |

---

## C. Reusable assets (build on these, don't rebuild)

- **Storage abstraction** (`app/marketplace/storage.py`) — reuse for A5 media (new public bucket).
- **Ledger + webhook-verify + idempotency** (`finance.py`) — real PSP (A2) plugs into the existing verify path; don't touch ledger math.
- **Rate limiter** (`app/core/ratelimit.py`) — pluggable store; just configure Redis/Upstash.
- **Notification creation points** — the send fan-out (A3) hooks where `Notification` rows are already written.
- **BFF proxy** (`frontend/src/app/api/backend/[...path]/route.ts`) — handles auth/refresh + binary; reuse for any new admin binary/file route.
- **RBAC dependency** (`require_staff`) — reuse to gate any new admin endpoint.
- **Audit service** (`app/services/audit.py`) — reuse for every new sensitive action.
- **CI matrix** (`ci.yml`) — extend with new test suites; branch protection already gates `main`.

---

## D. External credentials / infra / business decisions required

| # | Item | Type | Blocks |
|---|---|---|---|
| 1 | SMS provider + **DLT templates** | credential + regulatory | Production login/OTP (A1) |
| 2 | Payment PSP account + keys + webhook secret | credential + business | Real payments (A2) |
| 3 | FCM project + APNs key | credential | Push delivery (A3) |
| 4 | Supabase private KYC bucket + prod migration + env | infra/ops | KYC in prod (A4) |
| 5 | Public media bucket + CDN | infra + business | Media Library (A5) |
| 6 | Maps/geocoding provider (if in scope) | credential + business | Map UI / routing (A6) |
| 7 | Email provider (if in scope) | credential + business | Email (A7) |
| 8 | Sentry DSNs (backend + 2 apps) | credential | Observability (A8) |
| 9 | Redis/Upstash | infra | Correct rate limiting at scale |
| 10 | Apple Developer + Google Play accounts | credential + business | Store builds |
| 11 | Realtime service decision | architecture + business | Live tracking/offers at scale (A9) |

No credentials or secrets are present in the repository (only placeholders in `.env.example`); all of the above must be supplied via environment configuration.
