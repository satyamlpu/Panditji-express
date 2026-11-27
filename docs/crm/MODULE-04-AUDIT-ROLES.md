# Module 04 — Audit-Log Viewer + Roles & Permissions

**Phase:** 1 (Foundations: governance) · **Priority 4** of the enterprise-CRM build.
**Branch:** `feat/crm-audit-roles` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

Two **super-admin-only, read-only** governance windows. Purely additive and
non-duplicative: it surfaces the *existing* append-only `audit_log` and documents
the *enforced* `require_staff` gates — it does **not** reimplement PR #11's staff
management CRUD or the RLS/security migration.

## What shipped

### Backend — `backend/app/marketplace/routers/admin_audit.py` (super-admin only)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/mp/admin/audit` | Searchable, filterable, paginated view of `audit_log` (by action, entity, actor, free-text, date range) — actor, action, entity, before/after `meta`, IP, time |
| `GET /api/v1/mp/admin/audit/meta` | Distinct actions + entities (for filter dropdowns) |
| `GET /api/v1/mp/admin/audit/permissions` | The role→module **permissions matrix**, mirroring the enforced `require_staff` gates |

Reads here are deliberately **not** audited (a viewer that logged every page view
would drown the trail). New schemas; no mutations. The permissions matrix is a
single in-code declaration documented to be kept in sync with the router gates.

### Frontend — `marketplace/audit/page.tsx` + "Audit & Roles" nav
Two tabs:
- **Audit log** — filter by action + free-text search, paginated table (when /
  actor / action / entity), expandable `meta` (before/after JSON). A 403 renders a
  clear "super-admin only" message rather than an error.
- **Roles & permissions** — a module×role matrix (✓ per allowed role, super-admin
  everywhere) with per-module descriptions, noting it mirrors the backend gates.

Nav item added to `config/admin-nav.ts` (reuses the existing `security` /
ShieldCheck icon).

## Verification evidence
- **Backend:** `tests/test_audit_admin.py` — 3 tests (viewer lists + filters + meta
  preserved, meta/permissions matrix shape, RBAC: even ops is denied — super-admin
  only). **Full suite: 75 passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route
  `/admin/marketplace/audit` compiled).
- **End-to-end** (clean preview DB, real backend): the log tab shows **14 real
  events** (logins + `mp.dispatch.offer` / `mp.booking.create` by `system` on
  `booking` entities with expandable details); the matrix tab renders all roles ×
  modules correctly (Finance→finance, KYC→verification, Audit→super-admin). No
  console errors. Screenshots: `docs/crm/screenshots/audit-log.jpg`,
  `roles-permissions-matrix.jpg`.

## Merge notes
Additive shared-file touchpoints: `main.py` (one include line),
`features/marketplace/api.ts` (appended block), `config/admin-nav.ts` (one nav
item — union-merge with PR #11 / other module PRs). The permissions matrix is
documentation of enforcement; real role *assignment* is PR #11's Staff & Roles UI,
and RLS/DB-grant verification is PR #11's security migration — both intentionally
out of scope here.
