# 16 — Infrastructure & DevOps

## Current (verified)
- **Hosting:** Vercel, **two projects** from one repo — `frontend` (web, root
  `frontend/`, domain panditjiexpress.com) and `panditji-express2` (API, root
  `backend/`, explicit `@vercel/python` build of `api/index.py`). Production branch =
  `main` (push → prod). **[IMPLEMENTED]**
- **DB:** Supabase Postgres (transaction pooler :6543) + PostGIS. **[IMPLEMENTED]**
- **CI:** GitHub Actions — **Backend (PostgreSQL)** + **Frontend (lint·typecheck·build)**
  run on PRs (both green on recent PRs). **[IMPLEMENTED]**
- **Backups:** logical `pg_dump` script + daily workflow (`.github/workflows/backup.yml`)
  + restore runbook. **[PARTIAL]** — needs `DATABASE_URL` secret + a real run; Supabase
  **PITR not confirmed enabled**; restore drill not run (see 20).
- **Monitoring:** Sentry wired (backend + web). **[PARTIAL]** — no DSN set, so no events.
- **Secrets:** Vercel env vars + backend `validate_runtime()` refuses prod boot on
  default JWT/webhook/revalidate secrets. **[IMPLEMENTED]** (no secret manager/rotation).
- **Serverless correctness:** `NullPool` + psycopg `prepare_threshold=None` on the
  Supabase pooler; `greenlet` + `sqlalchemy[asyncio]` pinned (Vercel build fix). **[IMPLEMENTED]**

## Environments
| Env | Current | Target |
|---|---|---|
| Development | local SQLite + uvicorn + next dev | keep |
| Staging | **[MISSING]** | dedicated Vercel preview env + separate Supabase project |
| Production | Vercel + Supabase (live) | + runbooks, alerting, access reviews |

## CI/CD (target additions) [PROPOSED]
- Promote PR previews → staging → prod with **release gates** (tests + security checks).
- Block merge on: failing tests, security-critical failures, migration review.
- **Migrations in the pipeline:** run Alembic against staging; gated apply to prod with
  backup precondition; `CREATE INDEX CONCURRENTLY` for big tables.
- **Rollback:** Vercel instant rollback (redeploy previous); DB rollback via restore
  (forward-only migrations → prefer additive + feature flags over destructive).

## Containerization [PROPOSED / OPTIONAL]
- Current API runs on Vercel serverless (no Docker). If/when moving the API to a
  long-lived runtime (for queues/workers/WS), containerize (Docker) + a platform
  (Fly/Render/ECS/Cloud Run). **Decide by evidence** (serverless limits: cold starts,
  no background workers, execution time caps) — see ADR in 26.

## Background work (the key infra gap) [MISSING]
Serverless has **no durable workers**. Needed for: scheduled dispatch, notification
outbox, webhook retries, reconciliation, GPS batching, backups beyond cron. **Target:**
a queue (Redis/SQS/QStash) + worker runtime (container or managed cron/queue).

## Observability (target)
- **Logs:** structured JSON, request id, no PII.
- **Metrics:** RPS, latency (p50/p95/p99), error rate, DB pool, dispatch fill rate,
  payment success — per-endpoint SLIs (see 18).
- **Traces:** distributed tracing (Sentry perf / OTel) across web→API→DB.
- **Alerting:** error-rate, latency, failed-backup, rate-limit-store-down, payment
  webhook failures → on-call.

## Operations
- **Incident response:** severity levels, on-call, comms, postmortem (runbook [MISSING]).
- **Dependency/vuln scanning:** Dependabot + SAST + secret scan in CI [MISSING].
- **Access reviews:** periodic staff-role + cloud-access review [MISSING].
- **Release approvals:** required reviewer on `main`; protected branch [NEEDS-VALIDATION].

## Priority infra investments (ranked)
1. Set Sentry DSN + alerting (observability is currently blind).
2. Provision Redis (rate-limit shared store + presence + cache + locks).
3. Add a queue + worker runtime (unblocks scheduled dispatch, outbox, retries).
4. Object storage + signed URLs (KYC/media).
5. Staging environment + migration pipeline + backup/restore drill.
