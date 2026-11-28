# Module 03 — Live Operations Centre

**Phase:** 2 (Operations command center) · **Priority 3** of the enterprise-CRM build.
**Branch:** `feat/crm-live-ops` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

A Rapido-style real-time ops console built on the **existing dispatch + live-GPS**
infrastructure. Read-only and additive — manual (re)assignment reuses the existing
`POST /mp/admin/bookings/{id}/reassign` (each queue item links to the booking
detail where that control lives), so nothing here duplicates dispatch control.

> **No fabricated data.** Every location, availability, ETA and wait time is read
> from live state. A partner marker is flagged `is_live` only when a fresh GPS
> ping exists (partner on an active booking); otherwise it falls back to the
> declared base location and the UI says so. The map is an honest schematic of
> relative real coordinates (no street basemap / no external tiles / no maps key).

## What shipped

### Backend — `backend/app/marketplace/routers/admin_ops.py` (ops-gated)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/mp/admin/ops/overview` | Partner availability counts; booking counts (dispatching/active/unassigned/scheduled/completed-today); the **active**, **dispatching** and **unassigned** queues (with live ETA, wait time, live offers); and **alerts** (stuck_dispatch / no_partner / stale_location) |
| `GET /api/v1/mp/admin/ops/map` | Real coordinates only: online/busy partners (live ping if on an active booking, else base) + in-flight booking destinations + a computed center |

Alert thresholds (`dispatch_alert_seconds`, `stale_location_seconds`) are
**configurable query params**, not baked policy. New schemas; no mutations.

### Frontend — `marketplace/ops/page.tsx` + "Live Ops" nav item
Auto-refreshing (10s) console: KPI row, an **Attention needed** alert panel, a
dependency-free **SVG schematic map** (partners colored by availability, live vs
base, booking destinations, with a legend), and three queue columns (Active /
Dispatching / Unassigned) — every row links to the booking detail for reassignment.
Nav item added to `config/admin-nav.ts` (reuses the existing `activity` icon).

## Verification evidence
- **Backend:** `tests/test_ops_admin.py` — 4 tests (overview queues + counts,
  alerts surface stuck_dispatch + no_partner, map uses real coords only incl.
  live-vs-base, RBAC ops-only). **Full suite: 76 passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route
  `/admin/marketplace/ops` compiled).
- **End-to-end** (clean preview DB, real backend): console shows 3 real online
  partners, the dispatching booking `PJ-11F248` (1 live offer · Pandit Sharma,
  waiting ~10h) flagged as a `stuck_dispatch` alert, and the map plotting the 3
  partner markers + destination. Screenshots:
  `docs/crm/screenshots/live-ops-overview.jpg`, `live-ops-map-queues.jpg`.

## Merge notes
Additive shared-file touchpoints: `main.py` (one include line),
`features/marketplace/api.ts` (appended block), `config/admin-nav.ts` (one nav
item — overlaps PR #11's nav edits; union-merge). A tile-based street map
(Leaflet/Mapbox) is a follow-up — it needs a maps-provider key (an infra/business
decision), so this module ships the honest schematic instead.
