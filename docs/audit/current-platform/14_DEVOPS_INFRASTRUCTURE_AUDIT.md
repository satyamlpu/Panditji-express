# 14 — DevOps & Infrastructure Audit

## Current topology (verified)
- **Backend** → Vercel project `panditji-express2` (`panditji-express2.vercel.app`), ASGI via `api/index.py`, explicit `builds` + `api/requirements.txt`, NullPool serverless DB. LIVE.
- **Frontend** → Vercel project (`frontend-umber-six-66.vercel.app`). LIVE.
- **DB** → Supabase Postgres, transaction pooler (:6543, IPv4).
- **CI** → `.github/workflows/ci.yml`: backend job on `postgis/postgis:16-3.4` service + frontend job.
- **Repo** → `satyamlpu/Panditji-express`; prod branch `main @ e674ac5`.

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| **O-1** | **HIGH** | **No monitoring / error tracking / alerting / uptime checks** (no Sentry/Datadog/healthcheck pinger) for a live money system | repo has none |
| **O-2** | **HIGH** | **No backup / DR plan** documented or configured (Supabase tier PITR unverified) | 09 D-1 |
| **O-3** | **HIGH** | Custom domain `panditjiexpress.com` serves **empty 200** — DNS/Vercel domain misconfig; public entry point effectively broken | live check this session |
| O-4 | MEDIUM | **No background worker / cron** host → scheduled dispatch & offer-timeout cannot run (Vercel functions are request-scoped) | 10 DP-1/DP-2 |
| O-5 | MEDIUM | No staging environment distinct from Vercel preview; preview behind Deployment Protection (302) | this session |
| O-6 | MEDIUM | Secrets in Vercel env only; no secret manager / rotation runbook | 13 S-5 |
| O-7 | LOW | No IaC (Terraform/Pulumi); infra is console-configured | n/a |
| O-8 | LOW | No object storage/CDN for media uploads (read-only FS worked around with tempfile) | `main.py` uploads fallback |
| O-9 | INFO | Deployment runbook exists | `backend/DEPLOYMENT.md` |

## Strengths
Reproducible deploys via committed `vercel.json` + pinned requirements; CI runs tests against real PostGIS; health/readiness endpoints exist to wire an uptime check cheaply; deployment lessons captured in `DEPLOYMENT.md`.

## Classification
DevOps: **DEPLOYED but THIN.** The live stack works, but **no monitoring, no backups, no worker host, and a broken custom domain** make it not yet operable for real traffic. These are the lowest-cost/highest-impact items in the roadmap.
