# Test & Build Evidence

All results below were **re-run independently during this audit** (not taken on
trust), except the frontend build, which is read from the captured task logs and
clearly marked as such.

## Backend tests — RE-RUN (verified)

```
$ cd backend && .venv/bin/python -m pytest -q
51 passed, 6 skipped, 83 warnings in 6.19s
```

- Matches the reported **51 passed, 6 skipped**. ✅
- Python 3.14 in `backend/.venv`, SQLite (`panditji_test.db`).

### What the 6 skipped tests are (verified)
- **4 × `@pg_only`** true-concurrency tests — `test_marketplace_concurrency.py`
  (`@pg_only` at lines 195, 211, 286, 340). Skipped because SQLite lacks real
  `SELECT … FOR UPDATE`. These cover the double-accept / dispatch race invariants.
- **2 × PostGIS geo** tests — `test_marketplace_geo_postgis.py` (module-level
  `pytest.mark.skipif`, `:23`). Skipped without a PostGIS server.

### Warnings (non-blocking, noted)
- `InsecureKeyLengthWarning: HMAC key is 23 bytes` — the **test** `JWT_SECRET` is
  short; irrelevant to prod (prod enforces a strong secret). Because the OTP
  pepper falls back to `JWT_SECRET`, tests exercise OTP with that short key — fine
  functionally.
- One Starlette `HTTP_422` deprecation. Cosmetic.

## Ruff — RE-RUN (verified)

```
$ .venv/bin/python -m ruff check <all 7 edited backend files>
All checks passed!
```
Covers `ratelimit.py`, `observability.py`, `otp.py`, `admin.py`,
`admin_finance.py`, `main.py`, `config.py`. ✅

## Frontend build — from captured logs (NOT re-run this pass)

- The **successful** build log (`…/tasks/b9pu44vm5.output`) shows the full route
  table and `[exited with code 0]`. ✅
- An **earlier** build failed (`…/tasks/bvh2vz1q5.output`) on
  `captureRouterTransitionStart is not exported from '@sentry/nextjs'` (a Sentry
  **v9** API used against v8.55.2). That export was removed from
  `instrumentation-client.ts` (verified: the file no longer references it), and
  the rebuild passed.
- **Sentry is in the successful build:** `next.config.ts` wraps the config in
  `withSentryConfig(...)` unconditionally (static import), so the passing build
  ran through the Sentry plugin. Runtime capture still requires a DSN at deploy.
- **Not independently re-run in this audit** — stated plainly. A fresh
  `npm run build` is recommended as part of the merge gate.

## Coverage gaps (reported, not fabricated)

| Area | Gap | Risk |
|---|---|---|
| **Audit log** | No test asserts `audit_log` rows on refund/payout/reassign. The **duplication defect (A‑1)** is therefore invisible to the suite. | A test counting rows per action would have caught A‑1. |
| **OTP** | Happy-path only (`test_marketplace.py:54/58`). No assertion on HMAC/pepper, phone-binding (wrong-phone reject), expiry, attempt cap, or single-use. The flow test would pass even with the old `sha256`. | New security properties unverified. |
| **Rate limiter** | No 429 / over-limit test; no test of Redis/Upstash selection or the fail-open branch. Async path only smoke-covered (every authed request `await`s it). | R‑L1/R‑L3 behaviour unverified. |
| **RBAC** | No cross-role 403 denial test (e.g. SUPPORT token → finance refund). | Matrix verified by inspection only. |
| **Concurrency/geo** | The 6 PG/PostGIS tests did **not run** (SQLite). The P0 edits don't touch those locked paths, but the invariants are **not re-verified on Postgres** this pass. | Concurrency correctness assumed, not demonstrated here. |

## Note on tests
Per the task's rules, **no tests were created** in this audit. The gaps above are
reported for the implementer to close (recommended before/with merge, especially
the audit-log assertion that would expose A‑1).

## Area status: **PASS WITH CONDITIONS**
The reported backend numbers and lint are independently reproduced (51/6, ruff
clean). Conditions: re-run the frontend build in the merge pipeline; run the
6 PG/PostGIS tests on a Postgres instance before relying on concurrency
invariants; add assertion-level coverage for the P0 behaviours (audit rows, OTP
hashing, rate-limit 429).
