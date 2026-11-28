# Enterprise CRM — Implementation Tracker

**Initiative:** `feat/enterprise-crm-operations` — turn the Pandit Ji Express admin CRM
into a complete marketplace operations platform (Rapido / Urban Company class).
**Delivery model:** module-wise PRs under the parent initiative, each approval-gated
where it touches money, migrations, production, RBAC enforcement, KYC data or real
notifications.

This tracker is the single index of the 12 phases. Status values:
`Not started` · `In progress` · `In-flight (PR#)` · `Blocked` · `Done`.

> Phase 0 is this audit. Everything below Phase 0 is **proposed** sequencing, not a
> commitment — see [`PHASE-0-AUDIT.md`](./PHASE-0-AUDIT.md) for the evidence and the
> per-module classification that drives it.

---

## Phase status overview

| # | Phase | Status | Covers (modules) |
|---|-------|--------|------------------|
| 0 | **Audit & gap analysis** | **In progress** (this PR) | Full system audit, reusable-infra inventory, per-module gap table, PR roadmap |
| 1 | **Foundations: RBAC, audit, shell** | Partially in-flight (PR #11) | Roles & Permissions, Audit Logs, Staff, CRM nav/shell, System Health |
| 2 | **Operations command center** | Not started | Dashboard, Live Operations, Live Service Map |
| 3 | **Partners & KYC lifecycle** | Partially in-flight (PR #11) | Partners, KYC & Verification, Interviews |
| 4 | **Bookings & dispatch console** | Not started | Bookings, dispatch controls, reassignment, SLA |
| 5 | **Catalog & serviceability** | Partially done + in-flight (PR #16) | Services & Categories, Service Areas, Pricing, Samagri |
| 6 | **Finance operations** | Partially done | Payments, Partner Earnings, Payouts, Refunds & Disputes, Financial Ledger |
| 7 | **Invoices & tax** | Not started | Invoices & Tax (GST) |
| 8 | **Customer & engagement** | Not started | Customers, Reviews & Ratings, Support (deepening) |
| 9 | **Notifications & marketing** | Partially in-flight (PR #11) | Notifications (real channels), Marketing & Offers |
| 10 | **Analytics & reporting** | Partially in-flight (PR #11) | Analytics, exports, scheduled reports |
| 11 | **Platform admin & app mgmt** | Partially in-flight (PR #11) | Platform Settings, App Management, Media Library, Website CMS |
| 12 | **Production hardening & go-live** | Partially in-flight (PR #11) | Security/RLS, SLOs, load/DR, release gate |

---

## In-flight work that must NOT be re-built (credit these)

| PR | Branch | State | Delivers |
|----|--------|-------|----------|
| **#11** | `release/full` | Open, MERGEABLE | Interview KYC states, ops **Analytics**, scheduled-dispatch endpoint, **Staff & Roles** mgmt, **App Releases**, Razorpay provider seam, push-token registry, SMS/MSG91 adapter, Supabase Data-API lockdown + **RLS**, load tests, backup/restore. Carries the **prod migration `e7a1b2c3d4f5`**. |
| **#16** | `fix/website-cms-sync-thumbnail-management` | Open, MERGEABLE | CMS admin→public **sync fix** (revalidation), **Media Library** (`media_asset` + `PublicMediaStore` + Pillow/WebP), Service/Category **thumbnails**, **content revisions** history, admin audit + **sync-status** endpoint + Sync & Activity page, draft/publish/unpublish. Carries migration `d4f7b1a9c2e8`. |
| #14 | `feat/premium-mobile-ui-ux` | Open | Premium redesign of both Expo apps (shared design system). UI/UX only. |
| #15 | `feat/mobile-qa-polish` | Open | Mobile dark-mode, QA polish, EAS Android build config + built APKs. |
| #12 | (merged `main`) | Merged | EAS build config + app IDs. |
| #13 | (merged `main`) | Merged | Pandit→Panditji branding. |

**Merge-order note:** PR #11 and #16 both add `backend/app/api/routers/admin_media.py`,
`admin/(website)/media/page.tsx`, `config/admin-nav.ts` and `models/media.py`. They
are independent features that touch the same files — whichever merges first, the
second needs a trivial re-resolve (union of nav items + media routes). See
[`PHASE-0-AUDIT.md`](./PHASE-0-AUDIT.md) §9.

---

## Open business decisions (block the phases noted)

These are **not** to be hardcoded — they are product/finance decisions. See the
PR roadmap in [`PHASE-0-AUDIT.md`](./PHASE-0-AUDIT.md) §8.

| Decision | Current default in code | Blocks |
|----------|------------------------|--------|
| Platform commission % | `platform_commission_percent = 15.0` (env) | Phase 6 |
| Gateway fee % | `gateway_fee_percent = 2.0` (env) | Phase 6 |
| Payout cycle (on-demand vs scheduled) | On-demand, manual per-partner | Phase 6 |
| Cancellation / no-show charges | None (cancel is free) | Phase 4, 6 |
| KYC document policy (which docs, retention) | Free-form doc types, private storage | Phase 3 |
| Refund policy / dispute SLA | Manual, reason-required | Phase 6 |
| Serviceability model (radius vs zone/pincode) | Per-partner `service_radius_km` only | Phase 5 |
| SMS/push provider + spend | MSG91 adapter (PR #11), transport TBD | Phase 9 |
