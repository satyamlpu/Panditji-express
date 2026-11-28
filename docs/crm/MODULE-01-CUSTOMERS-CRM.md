# Module 01 — Customers CRM

**Phase:** 8 (People) · **Priority 1** of the enterprise-CRM build.
**Branch:** `feat/crm-customers` → `main`. Replaces the Customers `EmptyState` stub
with a fully functional, backend-persisted customer management surface.

Status: **Implemented · Tested · Verified end-to-end** (not yet merged/deployed).

## What shipped

### Backend — `backend/app/marketplace/routers/admin_customers.py`
Role-gated (`require_staff(OPS, SUPPORT)`; export is super-admin only), all
mutations audited via the existing `audit()` service.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/mp/admin/customers` | Directory: search (name/phone), status filter, sort, pagination, with live aggregates (bookings, completed, cancelled, net spend, reviews, open tickets, last booking) computed in batched group-by queries (no N+1) |
| `GET /customers/{id}` | 360 profile (summary + saved addresses) |
| `GET /customers/{id}/bookings` · `/payments` · `/reviews` · `/tickets` · `/activity` | Lazy profile tabs — reuse existing serializers (`booking_out`, `PaymentOut`, `ReviewOut`, `support.ticket_dict`) |
| `PATCH /customers/{id}` | Edit name / language (audited, diff recorded) |
| `POST /customers/{id}/suspend` · `/reactivate` | Lifecycle (reason required, audited). Suspension takes effect immediately — the auth principal re-reads status per request |
| `GET /customers/{id}/export` | Full account data export (super-admin only; audited PII access) |

New audit actions: `mp.customer.{update,suspend,reactivate,export}`
(`marketplace/constants.py`). New schemas appended to `marketplace/schemas.py`.

**Deliberate exclusions (documented, not oversights):**
- *No admin "create customer"* — customers self-register via phone + OTP.
- *No hard delete* — destructive + PII retention concern; suspension is the
  reversible control. Hard delete / GDPR erasure is an approval-gated follow-up.
- *Session/token revocation* — suspension already blocks all customer API access;
  explicit token revocation is a later auth-infra item.

### Frontend — `frontend/src/app/admin/(app)/marketplace/customers/page.tsx`
Enterprise directory + 360 drawer, built on the existing admin kit (crimson/gold
tokens, lucide icons, loading skeletons, honest empty states):
- Search box, status pills (All/Active/Suspended), sort select, pagination.
- `DataTable` with per-customer aggregates.
- Profile drawer: header, 6 summary tiles, inline edit, suspend/reactivate (with
  reason prompt), Export, and six lazy tabs (Bookings, Payments, Reviews, Tickets,
  Addresses, Activity). API client added to `features/marketplace/api.ts`.

## Verification evidence
- **Backend:** `tests/test_customers_admin.py` — 5 tests (directory+aggregates,
  search/filter, profile tabs, edit/suspend/reactivate lifecycle incl. the
  suspended customer losing API access, RBAC + export gate). **Full suite: 77
  passed / 6 skipped.** `ruff` clean.
- **Frontend:** `tsc --noEmit` clean · `next lint` clean · `next build` succeeds.
- **End-to-end** (clean preview DB, real FastAPI backend): admin login →
  Customers directory shows the seeded customer with a real booking count →
  profile drawer shows the live booking `PJ-11F248 · Satyanarayan Katha · ₹2,100`.
  No console errors. Screenshots: `docs/crm/screenshots/customers-directory.jpg`,
  `customers-profile-360.jpg`.

## Integration
Customer App ↔ CRM confirmed: a booking created through the customer API appears
in the CRM directory and profile; a CRM suspension immediately blocks the
customer API (`GET /mp/customer/profile` → 403). No fabricated data.
