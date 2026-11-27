# Module 05 — Finance Reports & Reconciliation

**Phase:** 6 (Finance operations) · **Priority 5** of the enterprise-CRM build.
**Branch:** `feat/crm-finance-reports` → `main`.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

**Read-only** finance reporting on top of the existing append-only ledger — it
reads, it never moves money, so there are **no approval gates** on this module. It
closes three gaps the base Finance page lacks (reconciliation, ledger drill-down,
refund history) and is **additive**: a new router + a new page, leaving the
existing `finance/page.tsx` (which PR #11 edits, and which owns the gated refund /
payout *actions*) untouched.

## What shipped

### Backend — `backend/app/marketplace/routers/admin_finance_reports.py` (finance-gated)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/mp/admin/finance/reconciliation?days=N` | Totals (gross, commission, gateway, payable, refunds, payouts, **net platform revenue**, outstanding) + a per-day breakdown |
| `GET /api/v1/mp/admin/finance/ledger?entry_type=&page=` | Filterable, paginated ledger **drill-down** (with booking code + settled flag) |
| `GET /api/v1/mp/admin/finance/refunds` | Refund history (amount, reason, who issued it, booking) |

New schemas; no mutations. Paths sit under the existing `/finance` prefix without
colliding with the base finance endpoints.

### Frontend — `marketplace/finance/reports/page.tsx` + "Finance Reports" nav
Three tabs: **Reconciliation** (metric cards + range selector + daily table),
**Ledger** (entry-type filter + pagination), **Refunds** (history table). A 403
renders a clear "finance staff only" message. Nav item added (reuses the
`analytics` icon); the base Finance item is now `exact` so it doesn't stay
highlighted on the reports route.

## Verification evidence
- **Backend:** `tests/test_finance_reports_admin.py` — 4 tests (reconciliation
  totals incl. net = commission − gateway and outstanding = payable − payouts;
  ledger feed + type filter; refund history; RBAC finance-only). **Full suite: 76
  passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc` clean · `next lint` clean · `next build` OK (route
  `/admin/marketplace/finance/reports` compiled).
- **End-to-end** (clean preview DB): seeded **via the real `finance.py` code path**
  (create order → `record_paid` → partial `create_refund`), then the reconciliation
  tab showed gross ₹4,200 / commission ₹630 / gateway ₹84 / net ₹546 / refunds
  ₹500 / outstanding ₹3,486, and the ledger tab showed all **9 genuine ledger
  entries** per booking. No console errors. Screenshots:
  `docs/crm/screenshots/finance-reconciliation.jpg`, `finance-ledger.jpg`.

## Approval-gated follow-ups (deliberately out of scope here)
- **Partial-refund execution UI** — surfacing the (already-supported) partial
  `amount_paise` on the existing Finance page: it edits `finance/page.tsx` (PR #11)
  and triggers a **money movement** (approval-gated). Left for a focused PR.
- **Disputes / chargebacks** — needs a new table + migration (prod migration is
  approval-gated) and a workflow; a dedicated module.
- **Scheduled payout cycles** — a payout-cadence **business decision** + money
  movement; gated.
