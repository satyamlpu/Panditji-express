# Module 08 — Service Areas

**Phase:** 5 (Catalog & serviceability) · **Priority 6**.
**Branch:** `feat/crm-service-areas` → `main`.

Status: **Implemented · Tested · Verified end-to-end (locally)** — **carries a new
migration; the prod migration run and merge are APPROVAL-GATED.**

A **managed catalogue** of named operational areas (centre + radius + optional
pincodes + active toggle), layered on top of the existing per-partner
`service_radius_km`. It does **not** change dispatch or booking behaviour.

## ⚠️ Gated step + open decision (read before merge)

- **New table / migration** `f1a2b3c4d5e6` creates `mp_service_area` (additive;
  no existing table altered, no data migrated). It was **run locally** (throwaway
  DB + the preview DB) for tests and the E2E demo. The **production migration must
  be run with approval**, per the program's migration gate — this session did not
  touch production.
- **Business decision needed — serviceability enforcement.** This module is a
  catalogue only. Whether booking/dispatch should be *gated* on these areas (e.g.
  reject bookings outside any active area, or outside a pincode allow-list) is a
  **product decision** and is deliberately **not wired into dispatch** here. The
  model deliberately supports both centre+radius and a pincode list so either
  policy can be adopted later without a schema change.

## What shipped

### Backend
- **Model** `ServiceArea` (`mp_service_area`): name, city, center_lat/lng,
  radius_km, pincodes (JSON), active, notes.
- **Migration** `alembic/versions/f1a2b3c4d5e6_service_areas.py` (additive,
  reversible; `d4f7b1a9c2e8 → f1a2b3c4d5e6`).
- **Router** `admin_service_areas.py` (ops / super-admin, mutations audited):
  CRUD (`list` with active filter, `create`, `get`, `update`, `delete`) + a
  `GET /coverage?lat=&lng=` check that reports which **active** areas cover a point
  (reusing the existing `haversine_km`). Audit actions are local string constants
  (`mp.service_area.*`) to avoid touching `constants.py`.
- New schemas (`ServiceAreaOut/Create/Update`, `CoverageOut`).

### Frontend — `marketplace/service-areas/page.tsx` + "Service Areas" nav
Table (name, city, radius, pincodes, active toggle), create/edit modal (centre,
radius, pincodes, notes, active), delete with confirm, and an inline **coverage
checker** (enter lat/lng → which active areas cover it). The page states plainly
that it is not yet wired into booking serviceability. Nav item added (reuses the
`locations` icon).

## Verification evidence
- **Migration:** applies cleanly on a throwaway DB and on the preview DB
  (`d4f7b1a9c2e8 → f1a2b3c4d5e6`); reversible `downgrade`.
- **Backend:** `tests/test_service_areas_admin.py` — 2 tests (full CRUD +
  coverage incl. deactivation excluding a point; RBAC ops-only). Tests use
  `create_all`, so they don't depend on the migration. **Full suite: 74 passed /
  6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route compiled;
  a transient `next/font` build blip cleared on retry).
- **End-to-end** (preview DB migrated locally): created "Kanpur Central" (15 km,
  pincodes 208001/208002), and the coverage checker returned **✓ Covered by
  Kanpur Central** for a nearby point. Screenshot:
  `docs/crm/screenshots/service-areas.jpg`.

## Merge notes
Additive touchpoints: `main.py` (one include line), `marketplace/models.py`,
`schemas.py`, `features/marketplace/api.ts`, `config/admin-nav.ts` (one nav item).
The migration is additive and independent. **Do not merge/deploy without running
the migration under the approval gate and settling the enforcement decision.**
