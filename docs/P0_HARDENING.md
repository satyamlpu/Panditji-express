# P0 — Safe-to-Operate Hardening

Milestone from `docs/audit/current-platform/20_IMPLEMENTATION_ROADMAP.md`. Branch:
`p0-production-hardening` (off `main`). Backend verified: **51 passed, 6 skipped**
(PG-only tests skip on SQLite), ruff clean. Frontend: production build verified.

## What changed (code)

### 1. Distributed rate limiter (R-6 / S-1)
`app/core/ratelimit.py` rewritten: `rate_limit()` is now async with a pluggable
store — **Redis** (`REDIS_URL`, via `redis.asyncio`), **Upstash REST**
(`UPSTASH_REDIS_REST_URL` + `_TOKEN`, over httpx, ideal for Vercel), or the
in-process fallback. On production with no shared store it logs a loud warning.
A shared store that errors at request time fails open (logged). The 4 call sites
(`api/auth`, `mp auth`, `customer booking`, `public enquiry`) now `await`.
Added `reset()` for tests.

### 2. Salted / keyed OTP hashing (R-8 / S-2)
`app/marketplace/otp.py`: OTP is now stored as **HMAC-SHA256(key, "phone:code")**
where key = `OTP_PEPPER` or (fallback) `JWT_SECRET` — both required non-default
in prod. Binds the code to the phone; a leaked `otp_code` table is useless
without the server secret. Verification uses `hmac.compare_digest` (constant
time). No migration needed (OTPs live ≤5 min).

### 3. Error monitoring / Sentry (R-5, part)
- Backend: `app/core/observability.py` + `init_observability()` in `main.py`.
  No-op unless `SENTRY_DSN` set; `send_default_pii=False`.
- Frontend: `@sentry/nextjs` wired (`sentry.server/edge.config.ts`,
  `src/instrumentation.ts`, `src/instrumentation-client.ts`, `withSentryConfig`
  in `next.config.ts`). No-op unless `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` set.

### 4. Audit-log enrichment on money/ops mutations (F-4) — CORRECTED
**Correction (A-1, from independent verification).** The original P0 change here
was based on a wrong premise. It claimed refund, payout and reassign "wrote no
central audit entry" and added router-level `audit()` calls for them. That was
**false**: `finance.create_refund` (`mp.payment.refund`), `finance.process_payout`
(`mp.payout.process`) and `dispatch.manual_reassign` (`mp.booking.reassign`)
**already wrote central `audit_log` rows at the service layer**. The added
router calls therefore produced **duplicate** audit records (and for reassign, a
second row with the identical action string).

**What is now in place:** the three duplicate router-level `audit()` calls have
been **removed**. The genuine gap — the pre-existing service-layer rows carried
only `actor_email`, not `actor_id` or the client IP — is closed by **enriching
the existing service-layer `audit()` calls**: the authenticated `actor_id` and
the **verified request client address** (`request.client.host`; no untrusted
`X-Forwarded-For` is trusted) are threaded from the router through the existing
`create_refund` / `process_payout` / `manual_reassign` call. Result: **exactly
one** audit row per action, with the original action names and entity types
preserved (payout keeps `entity="payout"` + the payout id), now enriched with
actor id + IP, still written inside the same transaction as the mutation (atomic
— a failed audit rolls the mutation back). Regression tests:
`tests/test_marketplace_audit.py`.

### 5. Backups / DR tooling (R-1)
- `backend/ops/backup_db.sh` — `pg_dump -Fc` with integrity check + retention.
- `backend/ops/RESTORE_RUNBOOK.md` — PITR enablement, restore drill, RTO/RPO.
- `.github/workflows/backup.yml` — daily scheduled logical backup.

## Correction to the audit — RBAC (A-1 / S-3 / R-7)
During implementation, closer inspection showed the audit's "RBAC not enforced
per-endpoint" was **overstated**. Verified reality:
- **Every content admin route** is gated at the router level by
  `dependencies=[Depends(require_admin)]` (deny-by-default; super-admin only).
- **Every marketplace admin mutation** is role-scoped via
  `require_staff(OPS | VERIFICATION | FINANCE | SUPPORT)`.
- No unguarded sensitive mutation was found.

So RBAC **is** enforced. The genuine residual was **audit-log coverage** (fixed
in #4). A real *delegation* gap remains (content editing is super-admin-only;
the `MARKETING`/`CONTENT` staff roles can't manage content) — that is a feature,
not a security hole, and is deferred to P4 (CRM depth).

## Manual steps the user must do (cannot be done from code)
| Step | Where | For |
|---|---|---|
| Enable **PITR** + daily backups | Supabase dashboard (Pro plan) | R-1 |
| Add repo secret `DATABASE_URL` (session-pooler/direct URL) | GitHub → Settings → Secrets | backup workflow |
| Create a **Sentry** project; set `SENTRY_DSN` (backend) + `NEXT_PUBLIC_SENTRY_DSN` (frontend) in both Vercel projects | Sentry + Vercel | R-5 |
| Provision **Redis/Upstash**; set `REDIS_URL` or `UPSTASH_REDIS_REST_URL`+`_TOKEN` on the backend | Upstash + Vercel | R-6 |
| (Optional) set a dedicated `OTP_PEPPER` | Vercel backend env | R-8 |
| Run the first **restore drill** | per runbook | R-1 |

## Not done in P0 (per roadmap sequencing)
Uptime pinger wiring (an external monitor hitting `/health/db` — a dashboard
action) is documented but not code. Everything else here is P1+.

## Verification
- `cd backend && .venv/bin/python -m pytest -q` → 51 passed, 6 skipped.
- `.venv/bin/python -m ruff check` on edited files → clean.
- `cd frontend && npm run build` → success with Sentry wired.
- PG-only concurrency/geo tests were **not re-run** this pass (require a Postgres
  instance); my edits add audit() calls and limiter/OTP logic that are
  DB-agnostic and don't touch the locked concurrency paths.
