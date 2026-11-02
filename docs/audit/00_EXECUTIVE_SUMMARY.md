# 00 — Executive Summary

**Product:** Pandit Ji Express — on-demand + scheduled pandit/puja marketplace (UP, India).
**Audit type:** Read-only, evidence-based technical audit (Phase 0). No code, DB, config, or git changes were made. The only files created are these audit documents under `docs/audit/`.
**Date:** 2026-10-31.
**Method:** First-hand file inspection plus three independent evidence agents (database, booking/dispatch+payments, security/devops/testing). Several findings were independently corroborated by 2–3 sources; the headline race condition was additionally re-verified by grep.

---

## A. Overall system health score

**59 / 100 — "Advanced MVP, not yet production-grade for scale or money."**

The platform is a well-structured, modular, feature-complete MVP of the full marketplace flow (discovery → booking → dispatch → tracking → payment → review), with a modern admin and two mobile apps. It is **not** production-ready for the stated "millions of users" or for handling real money without the remediations below, chiefly: a non-atomic assignment path, concurrency gaps in financial writes, SQLite + no horizontal-scale infrastructure, and no DevOps pipeline.

### Scoring methodology (transparent)
Each domain scored 0–100 from code evidence, weighted by business criticality for a money-handling marketplace. Weighted mean = overall.

| Domain | Score | Weight | Weighted |
|---|---|---|---|
| Architecture & code quality | 80 | 10% | 8.0 |
| Data integrity (schema) | 68 | 12% | 8.2 |
| Booking / dispatch correctness | 55 | 15% | 8.3 |
| Payments / financial | 65 | 12% | 7.8 |
| Security (application) | 72 | 15% | 10.8 |
| Scalability / performance | 35 | 12% | 4.2 |
| UI / UX | 82 | 5% | 4.1 |
| Testing / QA | 55 | 8% | 4.4 |
| DevOps / production readiness | 25 | 8% | 2.0 |
| Documentation | 75 | 3% | 2.3 |
| **Overall** | | **100%** | **≈ 60** |

Scores are judgments from static evidence, not load/pen-test measurements; "millions of users" readiness is **NOT VERIFIED** (no load testing performed or permitted in scope).

## B. Critical security findings
1. **[HIGH] Forgeable payment webhooks in a misconfigured prod.** `validate_runtime()` enforces only `jwt_secret`, not `payment_webhook_secret`/`revalidate_secret` (`backend/app/core/config.py:93-99`, default secret `config.py:64`). If left default in prod, anyone can sign a valid `/api/v1/mp/payments/webhooks/mock` body and mark bookings PAID + post partner-payable ledger rows. → Extend the startup guard.
2. **[MEDIUM] Stored-XSS via weak regex HTML sanitizer** (`frontend/src/lib/markdown.ts:17-31`) rendered through `dangerouslySetInnerHTML`; unquoted `onerror=`/`javascript:` survive. Admin-authored (lowers likelihood). → Use an allowlist sanitizer (DOMPurify).
3. **[MEDIUM] JSON-LD injection** — `JSON.stringify(ld)` injected without escaping `<`/`</script>` on several public pages. → Escape before injection.

## C. Critical data-integrity risks
1. **No atomic assignment / no row locking** anywhere (`with_for_update` appears only in a comment, `dispatch.py:11`). Two pandits can be confirmed on one booking under Postgres; no unique constraint backstops it.
2. **Status/enum columns are plain strings with no DB CHECK** — the DB will persist any invalid status; validity is app-only.
3. **Append-only money ledger uses `SET NULL` FKs and `payout_id` has no FK at all** (`mp_ledger_entry`, `models.py:239-251`) — deleting a booking/payment silently orphans financial linkage.
4. **No composite indexes; geo columns are unindexed floats** — dispatch matching is an O(n) in-Python haversine scan.

## D. Booking & dispatch weaknesses
- Non-atomic `accept_offer` (double-assignment race, stuck-BUSY partners).
- **Scheduled bookings are a dead path** — created at `requested` and never dispatched (no scheduler/worker exists).
- Offer expiry / acceptance timeout are **lazy** (only advance when someone reads the booking) — no background task.
- No idempotency key on booking creation; cancellation does not trigger refund.

## E. Scalability bottlenecks
SQLite single-writer dev/test DB (Postgres driver is wired but psycopg is commented out / not installed); in-memory rate limiter (won't work multi-instance); O(n) geo matching, no spatial index; no Redis/cache, no job queue, no realtime transport (tracking is HTTP polling); connection pool unsized.

## F. Missing modules (vs the target spec)
Scheduler/cron, background job queue, realtime (WebSocket), object storage (images are on local disk), PostGIS geo, full RBAC enforcement breadth (roles exist; coverage good but not exhaustive), coupons/promotions, notifications delivery (push/SMS — records exist, delivery not implemented), analytics/reporting depth, platform-governance workspace (admin users/roles/audit UI, integration/DB health, backups), CI/CD, monitoring/observability.

## G. Existing functionality that MUST be preserved
OTP auth (customer/pandit) + admin JWT/refresh BFF; the marketplace API surface (`/api/v1/mp/...`); the working dispatch happy path; the HMAC webhook + integer-paise + append-only ledger; Alembic migration chain; the CMS admin + public site; the two Expo apps; the Cycle 1–2 admin redesign (Control Center + two module shells).

## H. Recommended architecture
Keep the **modular monolith** (FastAPI). Do **not** split into microservices without measured need. Move to **PostgreSQL + PostGIS**, add **Redis** (rate limit + cache + dispatch offer timers), a **durable job queue** (scheduler, expiry, payouts, notifications), **object storage** for media, and a **realtime** layer (WebSocket or managed) for tracking. See `14_TARGET_ARCHITECTURE.md`.

## I. Prioritized remediation (top 10)
1. Enforce non-default `payment_webhook_secret` + `revalidate_secret` in `validate_runtime()` (HIGH, payment forgery).
2. Make `accept_offer` atomic (`SELECT … FOR UPDATE` on the booking row, or a unique "one active assignment per booking" constraint) + add a concurrency test.
3. Make webhook/refund/payout idempotent under concurrency (lock the payment row; unique "ledger-per-payment-event").
4. Replace the regex sanitizer with DOMPurify; escape JSON-LD.
5. Implement the **scheduler/worker** so scheduled bookings and offer expiry actually run.
6. Migrate dev/prod to PostgreSQL (+PostGIS) and tune the connection pool; enable psycopg.
7. Add CHECK constraints (or DB enums) on status columns; add composite indexes for dispatch/ledger; add FK on `payout_id`.
8. Object storage for uploads; sniff magic bytes; stream-limit upload size.
9. Containerize + CI pipeline + error tracking + DB backups/restore runbook.
10. Gate suspended pandits at the principal; parse trusted `X-Forwarded-For` for rate-limit keys.

## J. Exact first implementation milestone
**Milestone 1 — "Transactional & deployable core" (no new features):**
(a) atomic `accept_offer` + webhook/refund/payout concurrency guards + tests; (b) `validate_runtime()` secret hardening; (c) PostgreSQL migration verified against the existing Alembic chain; (d) Dockerfile + CI (lint/test/build) + DB backup runbook. Acceptance: concurrency tests pass on Postgres; `alembic upgrade head` clean on Postgres; CI green; no default secrets accepted in prod.

## K. Open decisions
See `18_OPEN_DECISIONS.md` — payment provider (Razorpay?), SMS/push provider, hosting target, realtime transport choice, media storage provider, staging environment, data-retention/privacy policy for GPS.

## L. Unverified assumptions
- Live `panditji.db` schema vs migrations (did not query `alembic_version`).
- Runtime Postgres behavior (psycopg uninstalled).
- Dependency CVEs (no `npm audit`/`pip-audit` run in read-only scope).
- Test suite pass/fail (not executed — would write to a test DB).
- "Millions of users" capacity (no load test).
