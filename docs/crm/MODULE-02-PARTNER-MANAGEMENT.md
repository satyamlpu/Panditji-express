# Module 02 — Partner Management (360)

**Phase:** 3 (Partners) · **Priority 2** of the enterprise-CRM build.
**Branch:** `feat/crm-partners` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

Adds a partner operations **360 view** on top of the existing verification flow.
It is **additive** — it never touches `routers/admin.py` (where verification
decisions and PR #11's interview states live), so it composes with both rather
than duplicating them.

## What shipped

### Backend — `backend/app/marketplace/routers/admin_partners.py`
Read-only, role-gated (`require_staff(OPS, VERIFICATION)`). Earnings figures reuse
the finance ledger (single source of truth) — no new finance logic.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/mp/admin/partners` | Enriched directory: search (name/phone/city), status + availability filters, sort, pagination, with batched aggregates (capabilities, completed bookings, rating avg, acceptance rate, outstanding payable) |
| `GET /partners/{id}/overview` | 360: profile + performance (completed/active/cancelled, acceptance, rating, offers) + earnings (lifetime / paid out / outstanding) + capabilities |
| `GET /partners/{id}/bookings` | Assigned-booking history |
| `GET /partners/{id}/reviews` | Ratings received |
| `GET /partners/{id}/earnings` | Earnings summary + ledger entries (payable/payout) + payout history |

Schemas appended to `marketplace/schemas.py`. **No new audit actions / no status
mutations** — suspend/approve/reject/interview remain in the existing verification
flow (and PR #11).

### Frontend
- **New route** `marketplace/partners/[id]/page.tsx` — the 360 page: header,
  performance tiles, earnings tiles, declared-services chips, and lazy tabs
  (Bookings / Reviews / Earnings with payouts + ledger).
- **Minimal edit** to `marketplace/partners/page.tsx` — a "360" link per row
  (kept tiny to limit overlap with PR #11's edits to that file).
- Partner API client added to `features/marketplace/api.ts`.

## Verification evidence
- **Backend:** `tests/test_partners_admin.py` — 4 tests (directory aggregates +
  filters, overview performance + earnings, earnings/tabs, RBAC: finance denied /
  verification allowed). **Full suite: 76 passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route
  `/admin/marketplace/partners/[id]` compiled).
- **End-to-end** (clean preview DB, real backend): partners directory lists seeded
  partners with capability counts; the 360 page for *Pandit Dwivedi* (Approved /
  Online, Kanpur, 5 services) shows real performance + earnings tiles (honest
  zeros — no fabricated data) and working tabs. Screenshots:
  `docs/crm/screenshots/partners-directory.jpg`, `partner-360.jpg`.

## Notes for merge
- Shared-file touchpoints with other module PRs / PR #11: `main.py` (one
  include_router line), `features/marketplace/api.ts` (appended block), and a
  small addition to `partners/page.tsx`. All additive — trivial re-resolve.
- Interview scheduling / reverification UI is intentionally **not** here; it
  belongs with PR #11's interview state machine.
