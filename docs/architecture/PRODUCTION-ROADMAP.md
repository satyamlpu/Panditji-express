# Pandit Ji Express — Production Roadmap

_2026-11-20, branch `main`. Companion to `CURRENT-SYSTEM-AUDIT.md` + `INTEGRATION-GAP-ANALYSIS.md`. Planning only — no code changed, no production infra touched._

Principle: **build on the existing architecture; do not rebuild working features.** Effort sizes are relative (S/M/L), not calendar commitments.

---

## 1. Critical blockers (must clear before any real launch)

| # | Blocker | Why critical | Class | Owner input needed |
|---|---|---|---|---|
| B1 | **No production OTP delivery** | Nobody can log in to prod (code only returned in dev) | ⛔ | SMS provider + DLT templates |
| B2 | **KYC storage not enabled in prod** + migration not applied | Verification endpoints 500 in prod; Vercel FS read-only | ⛔ | Supabase private bucket + run migration + env |
| B3 | **No real payment gateway** | No money can be collected/settled | ⛔ | PSP account + keys |
| B4 | **Broken DB backup workflow** | No verified backups → data-loss risk | 🔴 | fix workflow (+ decide retention) |
| B5 | **No load/scale testing** | 10M-user readiness unproven; rate-limit store single-instance | ⚪ | infra for test + Redis/Upstash |

B1–B3 are **external-dependency** blockers (code seams exist); B4–B5 are internal.

---

## 2. Phased implementation sequence

### Phase 0 — Production enablement of what's already built (S, do first)
- **P0.1** Apply migration `e1a2b3c4d5f6` to prod Supabase; create private `kyc-private` bucket; set `STORAGE_BACKEND=supabase` + `SUPABASE_*`. _(B2; runbook: `backend/docs/prod-migration-kyc-files.md`)_
- **P0.2** Decide + implement **migrations-on-deploy** (a release step or a documented manual gate) so this class of gap can't recur.
- **P0.3** Fix `.github/workflows/backup.yml`; verify a restore. _(B4)_
- **P0.4** Set prod `REDIS_URL`/Upstash so rate limiting is shared across instances; set Sentry DSNs.
- _Depends on: nothing in-repo; needs Supabase + Redis + Sentry creds._

### Phase 1 — Go-live integrations (the launch-critical seams)
- **P1.1 SMS/OTP (B1):** integrate provider in `otp.issue_otp`; keep the hashed-OTP + dev fallback. _Blocked by DLT approval lead time — start the paperwork now._
- **P1.2 Payments (B3):** wire real PSP into the existing signed-webhook + idempotency + ledger path (`finance.py`); do **not** change ledger math.
- **P1.3 Push delivery (A3):** add FCM/APNs (or Expo Push) send at the existing `Notification` creation points; registry already exists.
- _Depends on: Phase 0 (observability/backup) for safe operation. P1.1/P1.2/P1.3 are mutually independent → parallelizable once creds arrive._

### Phase 2 — Launch hardening & scale proof
- **P2.1 Load testing (B5):** k6/Locust against booking→dispatch→accept and webhook paths; set targets (p95 latency, throughput, DB connections); tune pool + rate-limit store from results.
- **P2.2 Pagination pass:** enforce limit/offset on every admin/customer list before data grows.
- **P2.3 Realtime (A9) decision:** if live map / instant offers are required at scale, choose a realtime transport (Vercel functions can't hold sockets).
- **P2.4 Background scheduler:** move offer-expiry off request-driven `tick()` to a durable scheduler/queue.
- _Depends on: Phase 1 (realistic flows to test) + Phase 0 (Redis)._ 

### Phase 3 — Product completeness & distribution
- **P3.1 Admin Media Library** (reuse storage abstraction; public bucket + CDN).
- **P3.2 Admin SEO engine** (sitemap data already exists in `public.py`).
- **P3.3 RBAC admin UI** (enforcement exists; add role-management screen).
- **P3.4 Mobile store builds** (EAS + store listings + native perms) — needs Apple/Google accounts.
- **P3.5 Test depth:** frontend e2e (Playwright) + mobile (Jest/RNTL + Maestro) + discovery tests.
- _Depends on: Phase 0 storage (P3.1); otherwise independent._

---

## 3. Dependencies between phases

```
Phase 0 (enablement) ──► Phase 1 (integrations) ──► Phase 2 (scale proof) ──► launch
      │                         │
      └── P0.1 storage ─────────┴──► P3.1 Media (reuses bucket pattern)
P3.* product/distribution can run alongside P1/P2 once Phase 0 is done.
```
- Phase 0 unblocks safe operation and KYC; it gates everything.
- Phase 1 items are independent of each other (parallel once creds land) but all want Phase 0's backups/observability first.
- Phase 2 needs Phase 1 (real flows) to produce meaningful numbers.
- Phase 3 is mostly independent; P3.1 depends only on P0.1.

---

## 4. Current architecture summary

Modular-monolith **FastAPI + PostgreSQL** backend (31 tables, 9 migrations, 67 tests green on real Postgres in CI) serving a **public website**, **admin CRM**, and **customer + partner Expo apps**. Core marketplace — booking lifecycle, nearest-partner dispatch (haversine/PostGIS), finance ledger (commission/fee/payout/refund), KYC verification with private file upload, reviews, support — is implemented and **test-verified**, **concurrency-safe** (row locks + unique indexes), and **security-hardened** (per-kind JWT, server-side RBAC, audit log, secret-guard, signed webhooks). Deployed on Vercel ×2 + Supabase, with CI + branch protection on `main`. Gaps are concentrated at **external seams** (SMS, PSP, push) and **ops/scale** (storage enablement, backups, migrations-on-deploy, load testing), plus admin Media/SEO and the lack of mobile store builds and FE/mobile tests.

---

## 5. Critical blockers (recap)
B1 prod OTP · B2 KYC storage+migration · B3 payment gateway · B4 broken backups · B5 no load test. B1–B3 need external credentials; B4–B5 are internal work.

---

## 6. Recommended implementation sequence (one line)
**Phase 0 (enablement) → Phase 1 (OTP ∥ payments ∥ push) → Phase 2 (load test + pagination + realtime decision) → Phase 3 (media/SEO/RBAC-UI/store builds/tests).**

---

## 7. Exact next development task

> **Task P0.1 — Enable KYC document storage in production.**
> 1. Apply Alembic migration `e1a2b3c4d5f6` to the prod Supabase database (per `backend/docs/prod-migration-kyc-files.md` — check `alembic_version` first, then Path A or B).
> 2. Create a **private** Supabase Storage bucket `kyc-private`.
> 3. Set backend prod env: `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET=kyc-private`; redeploy.
> 4. Run the prod smoke test in the runbook (upload → review → download → approve).
>
> **Why first:** it is the only blocker that is pure ops on **already-merged, test-verified code** (no new feature work, no external vendor lead time), and it stops a live 500 in the verification flow. In parallel, **start the SMS/DLT and PSP account paperwork** (B1/B3) because those have external lead times.
>
> _Requires from you:_ prod Supabase connection string + Storage access + Vercel env access (I cannot access these). No code changes are needed for P0.1.

---

_Audit complete. Per the brief: **stopping here and awaiting approval before any implementation.**_
