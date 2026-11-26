# Go-Live Checklist

_Living document. Status as of 2026-11-21, branch `feat/production-readiness`._
Legend: ✅ done · 🟢 code-ready, needs config · ⛔ blocked (external) · ⚪ not started.

## 1. Backend / infrastructure
- ✅ CI gates `main` (Backend-PostgreSQL + Frontend) via branch protection.
- ✅ Production secret-guard (refuses boot on default JWT/webhook/revalidate secrets).
- ✅ Correlation IDs + structured request logging.
- 🟢 `SENTRY_DSN` set in prod (backend + both apps) — code ready, DSN needed.
- 🟢 Shared rate-limit store (`REDIS_URL`/Upstash) in prod — in-process otherwise.
- ⛔ **Apply migrations to prod Supabase** (no auto-migrate on deploy): `e1a2b3c4d5f6`, `f2b3c4d5e6a7`, `a7c8d9e0f1b2`, `b8d0e1f2a3c4`. Runbook: `backend/docs/prod-migration-kyc-files.md`.
- ⛔ `DATABASE_URL` GitHub secret set → nightly backups run (workflow skips cleanly until then).
- ✅ Backup + restore verified locally (`backend/ops/restore_drill.sh`).

## 2. Integrations
- 🟢/⛔ **SMS/OTP** — provider abstraction ready; set `sms_provider=msg91` + MSG91 keys + **DLT template approved**.
- 🟢/⛔ **Payments** — Razorpay signature verifiers ready; set `payment_provider=razorpay` + keys; wire order creation; sandbox-test before live.
- ⛔ **Push** — depends on the device-token registry in **open PR #5** + FCM/APNs credentials.
- 🟢/⛔ **KYC storage** — `STORAGE_BACKEND=supabase` + private `kyc-private` bucket + `SUPABASE_*`.

## 3. Security
- ✅ Per-kind JWT, server-side RBAC (`require_staff`/`require_admin`) + RBAC admin UI.
- ✅ Audit log (actor + verified IP) on sensitive actions.
- ✅ Signed-webhook verification + idempotency on payments.
- ✅ Private KYC files (no public URL; nosniff; staff-gated + audited download).
- ⚪ Independent production security review / pen test (recommended before launch).

## 4. Mobile
- ✅ Customer + Partner apps build (tsc + expo lint) and run on Expo Web.
- ⛔ EAS dev/production builds + store listings (Apple Developer + Google Play accounts).
- 🟢 Point app `EXPO_PUBLIC_API_BASE` at prod; verify push once PR #5 + FCM/APNs land.
- ⚪ Real-device compatibility pass.

## 5. Website / CRM
- ✅ Public site + `/download` page (accurate "coming soon" until real builds).
- ✅ Admin CRM: operations, partners+KYC, bookings, finance, reviews, support, releases, staff/roles.
- 🟡 Media Library (needs public bucket/CDN) and SEO engine — not complete.

## 6. Observability / ops
- ✅ `/health` + `/health/db`.
- 🟢 Sentry + alerting (DSN needed).
- ⚪ Load test executed in staging (scripts ready: `backend/ops/loadtest/`).
- ✅ Rollback + release plans documented (`RELEASE-PLAN.md`, `ROLLBACK-PLAN.md`).

## Gate
Launch is **blocked** until §2 integrations (SMS, payments, push), the §1 prod
migration + backup secret, and §4 store builds are cleared. See `FINAL-TEST-REPORT.md`
for the GO/NO-GO call.
