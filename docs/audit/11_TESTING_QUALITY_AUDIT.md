# 11 — Testing & Quality Audit

**Framework:** pytest + pytest-asyncio (`asyncio_mode=auto`, `pyproject.toml`), httpx `ASGITransport`, isolated SQLite test DB with drop/create per test + rate-limiter reset (`tests/conftest.py`). Linting: ruff (backend), ESLint (frontend). Typecheck: `tsc` / `mypy`-not-present.

**Execution status: NOT RUN** — out of the read-only audit scope (the suite writes to `./panditji_test.db`; running it would execute DB writes, which the audit restrictions forbid). Results below are **by static inspection only**; run `pytest` in a sandbox/CI to get real pass/fail. The README's "21 tests" predates the marketplace additions.

**Backend tests:** 10 files, ~46 test functions.

## Coverage map (static)
| Domain | Covered? | Evidence |
|---|---|---|
| Admin AuthN | ✅ login ok/fail, me-requires-auth, route deny/allow | `test_auth.py` (5) |
| RBAC | ✅ admin routers require auth; mp admin/finance/support require staff | `test_content.py`, `test_marketplace.py`, `test_marketplace_finance.py`, `test_marketplace_support.py` |
| Booking lifecycle + dispatch | ✅ strong — nearest-offer+confirm, out-of-range no-partner, offline/unapproved exclusion, expired-offer→no_partner, cancel frees partner, full lifecycle→completed, manual reassign | `test_marketplace.py` (10) |
| Payments/finance | ✅ signed-webhook required, webhook idempotent (single-threaded), refund reason+cap, payout, review once/completed | `test_marketplace_finance.py` (6) |
| Tracking/location | ✅ active-booking gating, assigned gating, eta/freshness, notifications, completion stops tracking | `test_marketplace_tracking.py` (5) |
| Support | ✅ ticket scope isolation, create/list/reply, admin assign/resolve | `test_marketplace_support.py` (4) |
| Public visibility | ✅ published-only, draft 404, sitemap excludes draft | `test_public.py` (4) |
| Content/services | ✅ price propagation, slug→redirect, duplicate-slug conflict, draft-not-public, media rejects non-image | `test_services_admin.py` (4), `test_content.py` (5) |
| Enquiries | ✅ submit+visible, honeypot drop, phone validation | `test_enquiries.py` (3) |

## Critical coverage gaps
- **Dispatch concurrency** — the exact race the code flags (R1/S4) has **no concurrent-accept test**. This is the single most important missing test.
- **Webhook/refund/payout concurrency** — idempotency is tested only single-threaded; the double-credit/over-refund/double-payout races (R2/R3) are untested.
- **OTP negative paths** — expiry, max-attempts, wrong code (`otp.py`) untested.
- **Refresh-token rotation/revocation/reuse** (`auth_service.rotate_refresh_token`) untested.
- **Cross-customer booking access** — one customer reading another's booking is not asserted (scope negative test exists only for tickets).
- **Webhook forgery with wrong secret** — only implicitly covered.
- **Scheduled booking** path — untested (and non-functional, see `05`).
- **No frontend tests at all** — no jest/vitest/playwright; the regex sanitizer (S2), JSON-LD output (S3), BFF proxy/refresh-retry, and the admin shell are covered only by typecheck/build/lint.
- **No mobile tests** (customer-app / pandit-app).
- **No e2e, no a11y, no performance/load tests.**

## Status breakdown (per the brief)
- **Passed:** none asserted here — not executed in this audit.
- **Failed:** none observed (not executed).
- **Not run:** the entire suite (read-only scope) + all missing categories above.
- **Blocked:** concurrency tests are effectively blocked by the current SQLite single-writer setup (they only become meaningful on Postgres + after the locking fix).
- **Not applicable:** n/a.

## Recommendations
1. Add a **dispatch concurrency test** (two concurrent accepts → exactly one confirmed) and **webhook/refund/payout concurrency tests** — these gate the correctness fixes (R1–R3) and should run on Postgres.
2. Add OTP-negative, refresh-rotation, and cross-customer-access tests.
3. Introduce **frontend tests** (vitest + Testing Library for the sanitizer/JSON-LD/BFF; Playwright for the admin critical flows) and at least smoke tests for the two apps.
4. Wire **CI** to run ruff + pytest (on an ephemeral Postgres) + ESLint + `tsc` + `next build` on every change (see `12`); add `pip-audit`/`npm audit`.
5. Track coverage; target the money/booking paths first.
