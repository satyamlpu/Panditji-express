# Release Plan

How a change reaches production for Pandit Ji Express. Deploys are **not**
automatic on merge for the DB layer — the migration step is manual and gated.

## Backend + web (Vercel + Supabase)
1. **Branch + PR** off `main` (never push to `main` directly).
2. **CI must pass** — `Backend (PostgreSQL)` (ruff + `alembic upgrade head` on real
   Postgres + full pytest) and `Frontend (lint · typecheck · build)`. Branch
   protection enforces both.
3. **Migrations first (manual, gated).** If the PR adds migrations, apply them to
   prod Supabase **before/at** deploy — deploys do not auto-migrate. Use the
   session-pooler/direct URL. Procedure + rollback: `backend/docs/prod-migration-kyc-files.md`.
   Current unapplied heads on prod: `e1a2b3c4d5f6`, `f2b3c4d5e6a7`, `a7c8d9e0f1b2`,
   `b8d0e1f2a3c4`.
4. **Merge to `main`** (approval required) → Vercel auto-deploys backend
   (`panditji-express2`) and frontend.
5. **Verify**: `/health` + `/health/db` green; smoke the changed flow; watch Sentry.
6. **Config changes** (provider keys, `STORAGE_BACKEND`, `REDIS_URL`, `SENTRY_DSN`)
   are set in Vercel env and take effect on redeploy — coordinate with the migration.

## Mobile (EAS)
1. Bump version/build; set `EXPO_PUBLIC_API_BASE` to prod.
2. `eas build` (Android/iOS) → internal testing (Play internal / TestFlight).
3. Register the build in CRM **App Releases** (sets the `/download` links + checksum).
4. Promote to production listing after validation (store review lead time applies).

## Content
CMS edits publish via the admin and revalidate the site on demand (no redeploy).

## Sequencing for first launch
Integrations are independent once credentials arrive and can ship in parallel,
but each needs its config + (for payments) a sandbox pass before live. Order:
prod migration + backup secret → KYC storage → SMS → payments (sandbox→live) →
push (after PR #5) → mobile store builds → load test in staging → GO/NO-GO.

## Roles
- Engineer: PR + CI + migration dry-run.
- Approver/super-admin: merge, prod config, GO/NO-GO.
- On-call: watch health + Sentry post-deploy; own rollback (`ROLLBACK-PLAN.md`).
