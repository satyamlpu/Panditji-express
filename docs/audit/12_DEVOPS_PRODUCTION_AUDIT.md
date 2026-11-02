# 12 — DevOps & Production Readiness Audit

**Overall: the weakest domain (≈25/100).** The application code is deployable, but there is no automation, no containerization, no monitoring, and no backup/restore procedure.

## Findings
| Area | Status | Evidence |
|---|---|---|
| Containerization | **ABSENT** | No `Dockerfile`, no `docker-compose` (repo-wide find). |
| CI/CD | **ABSENT** | No `.github/workflows`, no pipeline of any kind. |
| IaC | **ABSENT** | No Terraform/Pulumi/CloudFormation. |
| Process manager / Procfile | **ABSENT** | No `Procfile`; README says "uvicorn behind a process manager" (prose). |
| Environments | **Single** | One `.env` + `app_env` flag; no distinct staging/prod config files. `.env.example` present in backend + frontend. |
| Migrations | **GOOD** | Alembic, 5 reversible versioned migrations; rollback documented (`alembic downgrade -1`). Deploy = manual `alembic upgrade head`. |
| Logging | **MINIMAL** | stdlib `logging` "panditji" logger used only for unhandled 500s (`core/errors.py`) and revalidation warnings (`services/revalidate.py`). No request logging, no structured/JSON logs. |
| Monitoring / APM | **ABSENT** | No Sentry/Prometheus/Datadog/OpenTelemetry. `/health` liveness endpoint exists (`main.py:59`). DB audit log exists for forensics (not ops). |
| Alerting | **ABSENT** | None. |
| Backups / restore | **ABSENT** | Not documented; only "content rollback" via admin unpublish (`README.md:203`). No DB backup/restore runbook. |
| Rollback | **Partial** | App: redeploy previous build; DB: `alembic downgrade`. No automated release/rollback. |
| Hosting / domain / SSL | **Not configured** | Local dev only (ports 8099/3000/8081/8082); README suggests Vercel (frontend) + a process manager (backend). |
| Secrets delivery | **Manual `.env`** | No secret manager; `validate_runtime()` blocks default JWT in prod (good) but not the webhook/revalidate secrets (see `08` S1). |
| Hygiene | Note | `backend/.venv/` (111 MB) is present in the delivered tree (gitignored). Root is not a git repo. |

## Deployment today (from README §Deployment)
Manual: provision Postgres → set `.env` → `alembic upgrade head` → run `uvicorn app.main:app` behind a process manager; frontend `next build && next start` or Vercel. Reversible via `alembic downgrade` + content unpublish. Honest and correct, but entirely manual.

## Risks
- **No CI** → regressions ship unverified; the correctness fixes (R1–R3) can't be guarded without automated concurrency tests in a pipeline.
- **No monitoring/alerting** → payment/dispatch failures are invisible until a user complains.
- **No backups** → data-loss risk for a money-handling system (unacceptable for prod).
- **Manual deploy** → error-prone, no repeatability, no audit of what shipped.
- **psycopg not installed** → the documented Postgres deploy would fail at import until enabled.

## Recommended operational procedures (to create)
1. **Containerize**: `Dockerfile` (backend, multi-stage, non-root) + `Dockerfile` (frontend) + `docker-compose.yml` (api + postgres + redis) for local/staging parity.
2. **CI** (GitHub Actions): lint (ruff/eslint) → typecheck (`tsc`) → `pytest` on ephemeral Postgres → `next build` → `pip-audit`/`npm audit`. Block merge on failure.
3. **CD**: build image → run migrations as a release step → deploy → smoke-test `/health` → auto-rollback on failure.
4. **Secrets**: a managed secret store (cloud KMS/Secrets Manager); extend `validate_runtime()` to reject all default secrets in prod.
5. **Observability**: structured request logging, error tracking (Sentry), metrics (Prometheus/OTel) with dashboards + alerts on payment/dispatch error rates and `/health`.
6. **Backups**: automated Postgres backups (PITR), a tested **restore runbook**, and a rollback runbook.
7. **Environments**: separate dev/staging/prod configs; a staging env mirroring prod for load/concurrency tests.
8. Remove `.venv/` from the delivered tree; initialize a single git repo at the project root.
