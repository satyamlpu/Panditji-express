# 02 — Repository Inventory

Monorepo root: `Panditji Express/` (git repo `satyamlpu/Panditji-express`). Four applications + docs + CI.

## Directory map
```
backend/        FastAPI API (Python)        → Vercel (panditji-express2) + Supabase
  app/          core/, api/routers/, marketplace/ (dispatch, finance, models…), db/, services/, models/
  api/index.py  Vercel ASGI entrypoint; api/requirements.txt (runtime deps)
  alembic/      6 migrations (versions/)
  tests/        pytest suite (auth, content, marketplace, finance, concurrency, tracking, support)
  requirements.txt · vercel.json · DEPLOYMENT.md · seed.py
frontend/       Next.js 15 admin + public site → Vercel (frontend-umber-six-66)
  src/app/(site)/  public website (home, puja-services, locations, book, policies…)
  src/app/admin/   Control Center + (website) CMS + (app) marketplace CRM
  src/components/, src/features/, src/lib/ (serverApi, config, api, session, types)
customer-app/   Expo RN (src/app/ expo-router)   → NOT deployed
pandit-app/     Expo RN (src/app/ expo-router)   → NOT deployed
docs/audit/     prior Phase-0 reports (00–18) + this current-platform/ set
.github/workflows/ci.yml   GitHub Actions (PG service + frontend)
```

## Languages / frameworks / versions (verified from package/req files)
| Area | Stack |
|---|---|
| Backend | Python (3.14 local / **3.12 on Vercel**), FastAPI ≥0.118, SQLAlchemy[asyncio] ≥2.0.43 + **greenlet**, Alembic ≥1.14, psycopg3 (binary), pydantic v2 + pydantic-settings, pyjwt (HS256), argon2-cffi, httpx, uvicorn |
| Frontend | Next.js 15.5, React 19, Tailwind 3.4, @tanstack/react-query, react-hook-form + zod, lucide-react; fonts Archivo/Inter/Noto Sans Devanagari (next/font) |
| Mobile | Expo SDK 58, expo-router, react-native 0.88 |
| DB | PostgreSQL (Supabase) in prod; SQLite (aiosqlite) in dev/test |
| Build/pkg | npm (frontend/apps), pip + requirements.txt (backend) |

## External services / integrations
- **Supabase** — Postgres (transaction pooler). ACTIVE (verified `/health/db`).
- **Vercel** — hosting for backend + frontend (two projects). ACTIVE.
- **Payment gateway** — **mock only** (`marketplace/routers/payments.py`); provider-agnostic behind an HMAC webhook. No real provider wired.
- **SMS / Push / Email** — **none**. OTP has a dev-only path; no delivery provider.
- **Object storage / CDN / Redis / queue / monitoring** — **none**.

## Git state (read-only, not modified)
- Current branch: `homepage-redesign` (clean working tree, no uncommitted changes).
- Production branch `main` @ `e674ac5`; recent history shows deployment-fix + redesign commits (`3fa8928…db3fa96`).
- Prior audit reports exist at `docs/audit/00…18`.

## Verification notes
Framework versions are read from `package.json` / `requirements.txt` (floors, `>=`). Exact installed versions on Vercel are **NOT VERIFIED** (no build-log access); runtime import of fastapi/sqlalchemy/psycopg **was** confirmed live via a temporary `/diag` probe this session (since removed).
