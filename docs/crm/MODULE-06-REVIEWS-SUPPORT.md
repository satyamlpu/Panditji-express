# Module 06 — Reviews & Support deepening

**Phase:** 8 (Engagement) · chosen after Priority 5.
**Branch:** `feat/crm-reviews-support` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

Closes the review/support gaps the Phase-0 audit flagged (reported-review filter
not surfaced; ticket escalate/close transitions existed in the backend but the UI
only offered "resolve"). Mostly additive; the small backend edit to
`admin_finance.py`'s review list is union-merge-safe with PR #11.

## What shipped

### Backend
- **`admin_support.py`** (new, additive endpoint): `GET /support/metrics` —
  open / assigned / escalated / **unassigned** counts, **resolved-today**, the
  **oldest open ticket's age**, and **SLA breaches** (open-state tickets older than
  a configurable `sla_threshold_hours`, default 24).
- **`admin_finance.py`** `list_reviews`: added `reported`, `hidden` and `rating`
  **filter query params** (the `reported` flag already existed on the model but was
  never queryable). Small additive change; `Query` import added.
- New `SupportMetricsOut` schema.

### Frontend
- **Reviews** (`reviews/page.tsx`): filter pills (**All / Reported / Hidden /
  1–2★**) wired to the new params, plus a red **Reported** flag badge on rows.
- **Support** (`support/page.tsx`): a **queue-metrics summary** row (open,
  unassigned, escalated, SLA breaches, resolved today), **SLA ageing badges** on
  open tickets (red past the 24h threshold), and **Escalate** + **Close** actions
  in the ticket drawer (the `ticketStatus` endpoint already supported those
  states; Close requires a resolution note, enforced server-side).
- API client: `reviews(params)` now takes filters; added `supportMetrics()` +
  `SupportMetrics` type.

## Verification evidence
- **Backend:** `tests/test_reviews_support_admin.py` — 2 tests (review filters:
  reported / hidden / rating; support metrics: counts + unassigned + SLA breaches
  + oldest-open age). **Full suite: 74 passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (both routes
  compiled).
- **End-to-end** (clean preview DB, seeded dev data): Support shows metrics
  Open 2 / Unassigned 2 / Escalated 1 / **SLA breaches 2** / Resolved today 1 with
  per-ticket ageing badges (9h, 12h, 1d, **2d red**); Reviews "Reported" filter
  shows the single 1★ reported review with its flag badge. No console errors.
  Screenshots: `docs/crm/screenshots/support-metrics-sla.jpg`,
  `reviews-reported-filter.jpg`.

## Merge notes
Additive touchpoints: `admin_finance.py` (review list filter params — union-merge
with PR #11, which also edits this file), `features/marketplace/api.ts`,
`schemas.py`, `admin_support.py`. No nav changes. No migrations, no money
movements, no approval gates.
