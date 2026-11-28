# Module 07 — System Health

**Phase:** 1/11 (Foundations / Platform admin) · chosen after Reviews/Support.
**Branch:** `feat/crm-system-health` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

A **super-admin-only, read-only** operations panel. Additive — a new router + a new
page; no migration, no money, no gates.

> **Secret-safe by design.** It reports configuration **names and booleans only**
> (which geo/storage backend, commission %, whether Supabase / revalidation are
> configured) — **never** a secret value. A test asserts the response contains no
> `jwt_secret` / `service_key` / `webhook_secret` / `password`.

## What shipped

### Backend — `backend/app/marketplace/routers/admin_system_health.py` (super-admin only)
`GET /api/v1/mp/admin/system/health` returns:
- **Database** liveness (a real `SELECT 1` round-trip) + dialect.
- **Live counters**: customers, partners (total/approved/online), bookings
  (total/active/dispatching/no-partner), reviews, open tickets, payments.
- **Config posture**: environment, is_production, geo/KYC/media backends,
  commission & gateway %, CORS origin count, docs-exposed, and `*_configured`
  booleans for Supabase KYC / media / public-site revalidation.
- **Warnings**: honest config signals (SQLite in production, local KYC storage in
  production, revalidation not configured).

New schemas (`SystemHealthOut`, `SystemCounters`, `SystemConfigOut`,
`SystemDatabase`). No mutations.

### Frontend — `marketplace/system/page.tsx` + "System Health" nav
Auto-refreshing (15s) panel: an ok/degraded status banner, a warnings list, DB +
geo/storage cards, a live-counter grid, and a configuration table (with a note that
only names/status are shown). A 403 renders a clear "super-admin only" message.
Nav item added (reuses the `activity` icon).

## Verification evidence
- **Backend:** `tests/test_system_health_admin.py` — 2 tests (DB connected +
  counters + config present **and no secret leaked**; RBAC super-admin-only).
  **Full suite: 74 passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route
  `/admin/marketplace/system` compiled).
- **End-to-end** (clean preview DB): page shows **All systems operational**, DB
  sqlite/connected, geo haversine, live counters (1 customer, 3 approved/online
  partners, 3 bookings, 1 dispatching, 4 open tickets, 2 payments), and the config
  table (dev, commission 15%, gateway 2%). No console errors. Screenshot:
  `docs/crm/screenshots/system-health.jpg`.

## Merge notes
Additive touchpoints: `main.py` (one include line), `features/marketplace/api.ts`,
`schemas.py`, `config/admin-nav.ts` (one nav item — union-merge). The CMS
sync-status (from merged PR #16) already has its own "Sync & Activity" page in the
Website module; this panel complements it on the App & CRM side.
