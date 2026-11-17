# 19 — Testing & QA Strategy

## Current (verified)
- **Backend:** pytest suite — **55 passed / 6 skipped** (6 are PG-only concurrency +
  PostGIS, skipped on SQLite); ruff clean. Covers auth, content, enquiries, marketplace,
  concurrency, finance, support, tracking, services-admin, and the A-1 audit tests.
- **CI:** GitHub Actions runs backend (PostgreSQL) + frontend (lint·typecheck·build) on
  PRs. **[IMPLEMENTED]**
- **Gaps:** no RBAC/IDOR negative suite, no OTP-hash assertions, no explicit rate-limit
  (429) test, no mobile/e2e/perf/security automation, concurrency tests run only on PG.

## Target test pyramid
| Layer | Scope | Status |
|---|---|---|
| **Unit** | pure logic (pricing, geo, eta, state transitions) | [PARTIAL] |
| **Integration** | router→domain→DB (httpx + test DB) | [IMPLEMENTED core] |
| **Contract** | OpenAPI snapshot; app ↔ API shapes | [MISSING] |
| **E2E** | web (Playwright) + mobile (Detox/Maestro) critical journeys | [MISSING] |
| **Security** | authz, RBAC, IDOR, injection, headers | [PARTIAL] (manual) |
| **Concurrency** | double-accept, over-refund, double-payout | [IMPLEMENTED] (PG-only) |
| **Payment** | signed webhook, idempotency, ledger correctness | [IMPLEMENTED core] |
| **Mobile** | offline, token storage, deep links, permissions | [MISSING] |
| **Offline/GPS** | queue+reconcile, stale location, geofence | [MISSING] |
| **Accessibility** | WCAG AA (web), platform a11y (mobile) | [MISSING] |
| **Performance** | load/stress/spike/soak | [MISSING] |
| **Resilience** | dependency-failure (Redis/queue/replica) | [MISSING] |
| **Backup restoration** | restore drill from dump/PITR | [MISSING] (runbook only) |

## Priority new suites (ranked)
1. **RBAC/IDOR negative suite** — every role × forbidden resource → 403; every principal
   → cannot read others' objects. (Release gate for authz work.)
2. **Security-critical money suite on PG** in CI — run the concurrency + finance tests
   against Postgres (not just SQLite) so race invariants are actually verified each run.
3. **OTP security assertions** — keyed hash, phone binding (wrong-phone reject), expiry,
   attempt cap, single-use; no `dev_code` in prod.
4. **Idempotency tests** — duplicate money POSTs → single effect.
5. **Contract tests** — snapshot `/openapi.json`; fail on unintended breaking change.
6. **E2E critical paths** — book→pay→track→rate (customer), online→offer→accept→complete→
   earnings (partner), verify→approve (admin).
7. **Load/spike** — festival surge on OTP + booking + dispatch.

## Release gates (rule #: critical failures block release)
A release is **blocked** if any of these fail:
- Security-critical: authz regression, injection, secret exposure, missing audit on money.
- Financial: ledger imbalance, non-idempotent money op, over-refund/double-payout.
- Data-integrity: failed migration, broken constraint, failed backup restore in drill.
- Core journeys E2E red.
A green build **alone** is never sufficient (lesson carried from P0 verification).

## Test data & environments
- Dev/CI: seeded SQLite/PG (`seed.py`, `seed_marketplace.py`), deterministic fixtures.
- Staging (target): anonymized data; no production PII in lower environments.
- Never run destructive migrations against prod in tests.

## Acceptance criteria
- Coverage targets per module (set after baseline); security/finance paths near-100%.
- CI runs PG + SQLite; concurrency suite not skipped in CI.
- Every new money/authz feature ships with its negative tests.
