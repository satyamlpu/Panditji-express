# 16 — Implementation Roadmap

Dependency-ordered, preserving existing functionality. **Phase 0 (this audit) is complete.** Each phase below lists Scope · Depends · Preserve · Changes · DB · API · Security · Acceptance · Tests · Rollback · Risks. Phases are grouped so correctness/safety lands before new features.

> Sequencing note vs the brief's numbering: the brief puts CMS at Phase 10. Because the existing CMS already works and the biggest risks are **transactional correctness, secrets, and infrastructure**, this roadmap front-loads a **hardening milestone (P1–P3)** before feature expansion. The brief's module order is otherwise followed.

### Phase 1 — Transactional & secret hardening (START HERE)
- **Scope:** Atomic `accept_offer` (row lock + unique "one accepted attempt per booking"); lock payment row in `record_paid`/`create_refund`; serialize `process_payout`; unique open-payment-per-booking; extend `validate_runtime()` to reject default `payment_webhook_secret`/`revalidate_secret`; force `debug=False` in prod; gate suspended pandits.
- **Depends:** none (works on SQLite for logic; locking verified on Postgres in P2). **Preserve:** all current flows/APIs.
- **Changes:** `dispatch.py`, `finance.py`, `config.py`, `principals.py`. **DB:** add unique indexes (new Alembic revision). **API:** unchanged (loser gets clean 409).
- **Security:** closes S1, S5, S9; mitigates R1/R2/R3. **Acceptance:** concurrency tests pass; prod refuses default secrets. **Tests:** new concurrency tests (accept/webhook/refund/payout). **Rollback:** `alembic downgrade`; revert code. **Risks:** lock contention — measure.

### Phase 2 — PostgreSQL + PostGIS migration
- **Scope:** Enable psycopg; run the Alembic chain on Postgres; add CHECK/enum constraints on status columns; add composite indexes; add FK on `ledger.payout_id`, change ledger FKs to RESTRICT; add PostGIS geo columns + GiST, switch matching to `ST_DWithin`; tune connection pool.
- **Depends:** P1. **Preserve:** schema semantics; keep lat/lng during transition. **Changes:** `requirements.txt`, `session.py`, new migrations, `dispatch.py` geo path.
- **DB:** major (validated, additive, reversible — see `04`§F). **API:** unchanged. **Security:** enum CHECK prevents invalid states. **Acceptance:** `alembic upgrade head` clean on PG; concurrency tests pass on PG; geo matching via index. **Tests:** P1 tests on PG + geo tests. **Rollback:** keep SQLite path; downgrade migrations. **Risks:** data validation before constraints; PostGIS availability on host.

### Phase 3 — DevOps baseline (Docker + CI + backups + monitoring)
- **Scope:** Dockerfiles (api/frontend) + compose (api+pg+redis); GitHub Actions (ruff/eslint/tsc/pytest-on-PG/next build/pip-audit/npm audit); error tracking (Sentry) + structured logs + `/health` checks + basic metrics/alerts; automated PG backups + restore/rollback runbooks; staging env; init a single git repo; drop `.venv/` from the tree.
- **Depends:** P2 (CI runs tests on PG). **Preserve:** everything. **Changes:** new infra files only. **DB:** none. **API:** none.
- **Security:** secret store; audits in CI. **Acceptance:** CI green on PRs; staging deploy + restore drill succeed. **Rollback:** infra is additive. **Risks:** cloud account/secrets provisioning (business decision — see `18`).

### Phase 4 — Scheduling engine + job queue + real expiry
- **Scope:** Redis + durable queue + worker; scheduler for scheduled-booking dispatch (at `scheduled_at − lead`), offer-expiry/acceptance-timeout, no-partner re-dispatch, stale-booking auto-cancel; pandit availability/slot model to prevent scheduled conflicts; move rate limiter to Redis.
- **Depends:** P2, P3. **Preserve:** immediate-booking behavior. **Changes:** new `scheduling` module + worker; `dispatch.py` (remove read-triggered `tick`); new slot table.
- **DB:** add slot/schedule tables (migration). **API:** scheduled bookings now progress; add idempotency key to booking create (R5). **Security:** worker auth to queue. **Acceptance:** a scheduled booking dispatches autonomously; offers expire without a reader; duplicate POST is idempotent. **Tests:** scheduler + expiry + idempotency + slot-conflict. **Rollback:** feature-flag the scheduler. **Risks:** time-zone/lead-time correctness.

### Phase 5 — Customer & Pandit CRM completion
- **Scope:** Customer admin endpoints + directory/profile/history; partner profile KYC-doc viewer + payout/earnings/performance; verification audit history.
- **Depends:** P1 (RBAC). **Preserve:** partner verification flow. **Changes:** new admin endpoints + admin UI (reuse kit). **DB:** none new (reads). **API:** additive. **Security:** role-gated, PII access audited. **Acceptance:** CRM directories with server-side pagination/filter. **Tests:** access-scope + pagination. **Rollback:** additive. **Risks:** PII exposure — gate strictly.

### Phase 6 — Notifications delivery
- **Scope:** Push (Expo/FCM/APNs) + SMS (provider) delivery via the queue; admin compose/broadcast; wire existing notification records to real sends; booking/dispatch/payment event hooks.
- **Depends:** P4 (queue). **Preserve:** notification table. **Changes:** `notifications` delivery module + provider adapters. **DB:** add delivery-status fields. **API:** additive. **Security:** provider secrets in store; opt-out handling. **Acceptance:** real push/SMS on key events. **Tests:** delivery + retry + opt-out. **Rollback:** flag off. **Risks:** provider choice/cost (see `18`).

### Phase 7 — Media/object storage + CMS depth + SEO
- **Scope:** Object storage + CDN for uploads; real Media Library (grid/search/alt/usage-checks/WebP-AVIF); Homepage Builder (reorder/preview/section publish); SEO editor (canonical/OG/sitemap/robots/structured-data); page revision history.
- **Depends:** P3. **Preserve:** existing CMS + public site. **Changes:** media service + admin UIs; migrate `uploads/` to storage. **DB:** media/revision tables. **API:** additive + migration of media URLs. **Security:** signed URLs; sniff uploads (S6); fix sanitizer/JSON-LD (S2/S3). **Acceptance:** media served from CDN; no broken published pages on replace/delete. **Tests:** upload/usage-check + sanitizer/JSON-LD tests. **Rollback:** dual-read during migration. **Risks:** URL migration.

### Phase 8 — GPS realtime + device integration
- **Scope:** WebSocket (or managed) realtime for active-booking tracking via Redis pub/sub; wire device GPS + OS permissions in both apps; purge location on terminal transitions + retention policy; accuracy gating/throttle; road-distance ETA (optional).
- **Depends:** P2, P4. **Preserve:** polling as fallback. **Changes:** realtime gateway + app location modules. **DB:** optional retention fields. **API:** realtime channel + existing endpoints. **Security:** authz on socket; consent copy. **Acceptance:** sub-10s live ETA without polling; location purged on completion. **Tests:** realtime + purge. **Rollback:** fall back to polling. **Risks:** mobile background-location review (store policies).

### Phase 9 — Pricing/commission + Analytics + Governance workspace
- **Scope:** Per-service/dynamic pricing UI; refund-aware reconciliation + finance reports; analytics (trends/cohorts); Platform Governance workspace (admin users/roles UI, audit-log viewer, integration/DB-health, backup status, incident mgmt).
- **Depends:** P2, P3, P5. **Preserve:** flat commission math. **Changes:** pricing + analytics + governance modules/UI. **DB:** pricing rules table. **API:** additive. **Security:** governance is super-admin-gated. **Acceptance:** reconciliation matches ledger; governance dashboards read real data. **Tests:** reconciliation + RBAC. **Rollback:** additive. **Risks:** analytics on OLTP — consider a read replica.

### Phase 10 — Security, performance & QA hardening
- **Scope:** Full RBAC coverage audit + role→workspace gating; frontend/mobile/e2e/a11y tests; `pip-audit`/`npm audit` gating; **load tests** (dispatch concurrency, booking throughput, GPS storm, webhook burst) against staging; tune to the SLOs in `09`.
- **Depends:** P1–P9. **Acceptance:** SLOs met under load; a11y AA; audits clean. **Tests:** the full matrix in `11`. **Rollback:** n/a. **Risks:** load-test findings may reopen earlier phases — budget for it.

### Phase 11 — Staging soak & controlled production release
- **Scope:** Staging soak; canary/gradual rollout; runbooks (deploy/rollback/incident/restore); on-call + alerts live.
- **Depends:** all. **Acceptance:** canary healthy; backups + restore verified in prod-like; rollback rehearsed. **Risks:** first real-money flow — keep the payment kill-switch (`mock/pay` already prod-disabled; add a provider circuit breaker).

## First milestone (exact)
**Milestone 1 = Phase 1 + the migration slice of Phase 2 + the CI slice of Phase 3:** atomic accept + webhook/refund/payout guards + secret hardening (with concurrency tests), verified on PostgreSQL, running in CI. This makes the money/booking core *safe* and *verifiable* before any feature expansion.
