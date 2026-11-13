# Backend deployment on Vercel (FastAPI + Supabase)

Frontend (Next.js) and backend (FastAPI) are **two separate Vercel projects**
from the same repo, plus Supabase Postgres. This documents the backend project.

## Canonical structure (do not duplicate)

```
backend/                     ← Vercel "Root Directory" = backend
├─ api/
│  ├─ index.py               ← ASGI entrypoint:  from app.main import app
│  └─ requirements.txt       ← runtime deps installed by @vercel/python (next to entrypoint)
├─ requirements.txt          ← full deps for local dev + Alembic
├─ vercel.json               ← { "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }] }
└─ app/…                     ← the application (app.main:app)
```

Request flow: Vercel routes every path to `api/index.py`, which imports
`app.main:app`. `@vercel/python` installs `api/requirements.txt` (beside the
entrypoint) and serves the ASGI app.

## Required Vercel project settings (Settings → …)

- **Build & Deployment → Root Directory = `backend`** (mandatory).
- **Git → Production Branch = `main`** (so pushes to `main` become production).

## Environment variables (Settings → Environment Variables)

| Key | Notes |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | Supabase **Transaction pooler** URL (port 6543). Secret. |
| `JWT_SECRET` | real random secret — app refuses to boot otherwise |
| `PAYMENT_WEBHOOK_SECRET` | real random secret |
| `REVALIDATE_SECRET` | must match the frontend project's value |
| `CORS_ORIGINS` | the frontend origin, e.g. `https://<frontend>.vercel.app` |
| `FRONTEND_REVALIDATE_URL` | `https://<frontend>/api/revalidate` |
| `SITE_URL` | `https://<frontend>` |

The app normalises `postgresql://…` → `postgresql+psycopg://…` and uses
`NullPool` + disables psycopg prepared statements on serverless (Supabase
pooler-safe). `DATABASE_URL` must be the **pooler** URL, not the IPv6 `direct`
host (Vercel functions can't reach the direct host).

## Health checks

- `GET /health` → `{"status":"ok","env":"production"}` — app booted.
- `GET /health/db` → `{"status":"ok","db":"connected"}` — DB reachable.

## Troubleshooting: `FUNCTION_INVOCATION_FAILED` / `ModuleNotFoundError: fastapi`

This means the **running deployment was built without dependencies**. The code
and config above are correct and verified locally, so if this persists it is a
**deployment-state problem, not a code problem**. The giveaway is an *identical*
error that never changes after new commits — that means the production
deployment is **not the latest build**. Check, in order:

1. **Is production on the latest commit?** Deployments → the top deployment →
   confirm its **commit SHA = the latest `main` commit** and status = **Ready**
   (not Error). If it's an old commit, production never advanced.
2. **Production Branch = `main`?** (Settings → Git). If not, pushes only make
   *preview* deployments and production stays stale.
3. **Trigger a clean build — don't redeploy an old one.** Deployments → the
   latest → ⋯ → **Redeploy** → **uncheck "Use existing Build Cache"**. Re-using
   an old build (or an empty cached pip layer) reproduces the same error.
4. **Read the Build Log** (open the deployment → the build step). Confirm you
   see `Installing required dependencies…` / `pip install` succeeding. If pip
   errors, fix that package; if pip never runs, the Root Directory/entrypoint is
   misread.

Only the Build Log distinguishes "deps failed to install" from "stale
deployment"; the runtime log (`ModuleNotFoundError`) is the symptom of both.
