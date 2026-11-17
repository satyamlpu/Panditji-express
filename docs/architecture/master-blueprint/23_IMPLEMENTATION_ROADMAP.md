# 23 — Implementation Roadmap (P0–P10)

Dependency-aware, additive. Each milestone lists: features, modules, likely files/dirs,
APIs, DB changes, dependencies, security, tests, acceptance, rollback, release gates.
**No implementation is started by this blueprint.**

## P0 — Audit, security foundation, infrastructure ✅ (largely done this session)
- **Done:** distributed rate limiter, keyed OTP, Sentry wiring, backup script+workflow+
  runbook, audit-log A-1 fix. Verified 55/6 tests, ruff clean. **Deployed to prod.**
- **Remaining (operational):** set Sentry DSN, provision Redis, set backup `DATABASE_URL`
  secret + run backup + restore drill, enable Supabase PITR, change default admin
  password, set `OTP_PEPPER`.
- **Gate:** operational prerequisites evidenced before claiming P0 "safe-to-operate".

## P1 — Identity, authorization, core data
- **Features:** device sessions, admin MFA + step-up, permission registry (RBAC→+ABAC),
  account recovery, idempotency keys, OpenAPI publish + contract tests.
- **Modules/files:** `core/security`, `deps`, `principals`, new `authz/policy`; new
  tables `device_session`, `permission`/`role_permission`, `idempotency_key`.
- **Security:** maker-checker scaffolding, separation-of-duties, break-glass.
- **Tests:** RBAC/IDOR negative suite; idempotency tests; run concurrency on PG in CI.
- **Gate:** no authz regression; negative tests green.

## P2 — Catalogue, geography, availability, booking
- **Features:** structured samagri, add-ons, coupons, service zones (polygons),
  availability calendar, scheduled-booking data model.
- **DB:** `addon`, `coupon`, zone geometry, availability slots.
- **Gate:** pricing correctness tests; no regression to existing booking.

## P3 — Dispatch & partner workflows
- **Features:** scheduled-dispatch worker, offer backoff/radius widen, heartbeat-loss
  auto-reassign, partner KYC upload (object storage + signed URLs), bank account +
  penny-drop, self-service payout request, dispatch live-ops board.
- **Deps:** queue/worker runtime, object storage, Redis presence.
- **Gate:** concurrency invariants hold; KYC docs private; no double-assign.

## P4 — Payments, finance, notifications
- **Features:** **real PSP** (order + verified webhook + idempotency), reconciliation,
  maker-checker on money, financial reports; **notification outbox** + FCM/APNs + SMS
  (DLT) + email; `push_token` registration.
- **Deps:** PSP account, SMS/DLT provider, push credentials.
- **Gate:** ledger balances reconcile; no money op without audit; outbox exactly-once.

## P5 — Customer mobile app (ship)
- **Features:** complete journeys (02), secure token storage, offline rules, push,
  invoices, reschedule, privacy/account-deletion; store compliance.
- **Deps:** P1/P4 (auth, payments, notifications).
- **Gate:** E2E customer journey green; store privacy requirements met.

## P6 — Partner mobile app (ship)
- **Features:** complete journeys (03), background location on active job, samagri
  checklist, earnings/payout, KYC wizard.
- **Gate:** E2E partner journey green; background-location policy correct.

## P7 — Admin CRM & CMS depth
- **Features:** staff/role admin UI, analytics module, dispatch board, finance recon +
  reports, audit/security viewer, CMS (blog, object-storage media, SEO engine, revision
  history).
- **Deps:** analytics pipeline (events), object storage.

## P8 — Integration & end-to-end testing
- **Features:** full E2E across web+apps+admin, load/spike/soak/resilience, security
  (RBAC/IDOR/injection), backup-restore drill, performance baselines vs SLOs.
- **Gate:** all release gates (19) pass; load evidence recorded.

## P9 — Controlled Uttar Pradesh launch
- **Features:** limited geo rollout, on-call + incident runbooks, alerting live,
  monitoring dashboards, support SLAs, staged user onboarding.
- **Gate:** SLOs observed in staging/soft-launch; DR drilled; rollback ready.

## P10 — Scale, resilience, expansion
- **Features:** read replicas, partitioning, realtime tracking, regional resilience,
  search, per-module service extraction **only if measured**; geographic expansion.
- **Gate:** load-test evidence before any scale claim; no premature distribution.

## Cross-cutting rollback principle
Prefer **additive** changes + **feature flags** over destructive ones. Every milestone
defines: a backup precondition for DB changes, a Vercel instant-rollback path for code,
and a flag to disable new behavior without a redeploy.

## Dependency graph (summary)
```
P0 ─▶ P1 ─▶ P2 ─▶ P3 ─▶ P4 ─▶ P5 ─▶ P6
                     └─▶ P7 ──────────▶ P8 ─▶ P9 ─▶ P10
(P4 unblocks P5/P6; P1 unblocks everything; infra from P0/P1/P3 unblocks workers/storage)
```
