# Phase 0 — Enterprise CRM Audit & Gap Analysis

**Initiative:** `feat/enterprise-crm-operations`
**Scope of this document:** a read-only audit of the existing Pandit Ji Express
platform, an inventory of reusable infrastructure, a per-module gap analysis against
the enterprise-CRM brief, a CRM↔app integration matrix, and a proposed phased PR
roadmap. **No feature code, migrations, deployments or production data were touched.**

Companion: [`IMPLEMENTATION-TRACKER.md`](./IMPLEMENTATION-TRACKER.md) (the 12-phase
index). Prior art already in the repo: `docs/architecture/master-blueprint/*` (the
target SRS/blueprint) and `docs/audit/current-platform/*` + `docs/audit/*` (earlier
platform audits). This document is the CRM-program-specific synthesis that drives the
PR roadmap; it supersedes nothing and cites current code.

---

## 1. Headline findings (TL;DR)

**The backend is far more complete than the CRM UI.** The marketplace domain — the
hard part — is genuinely built: a real booking state machine, concurrency-safe
dispatch, KYC verification with private document storage, an append-only finance
ledger with commission/refund/payout logic, support tickets, reviews, in-app
notifications, role-gated admin APIs, and an append-only audit log. Two open PRs
extend this substantially.

**The gap is overwhelmingly in the admin front end and a handful of net-new
operational modules**, not in rebuilding core logic.

- **Biggest reusable assets:** the marketplace data model (`mp_*` tables), the
  dispatch engine (`dispatch.py`), the finance ledger (`finance.py`), the RBAC
  seam (`require_staff`), the audit service (`audit()`), and the existing CMS.
- **Headline gaps (true "Missing"):**
  1. **Customers** CRM — admin page is a `EmptyState` stub; no customer 360 /
     search / lifetime-value / block-manage UI, though all customer data exists.
  2. **Live Operations / Live Service Map** — no real-time ops console or map view;
     live partner GPS exists per-booking but is not surfaced as an ops map.
  3. **Service Areas** — no zone/pincode serviceability model (only per-partner
     `service_radius_km`).
  4. **Pricing** — only a flat per-service `price_paise`; no pricing rules, surge,
     zone pricing, or cancellation charges.
  5. **Samagri** — exists only as a `list[str]` on a service; no managed
     catalog/inventory/orderable module.
  6. **Marketing & Offers** — no coupon/discount/campaign engine at all.
  7. **Invoices & Tax (GST)** — none.
  8. **Refunds & Disputes** — refunds are built; **disputes/chargebacks** are not.
  9. **Real notification channels** — in-app feed exists; push/SMS transport is only
     a seam (push-token registry + MSG91 adapter in PR #11, delivery deferred).
- **In-flight (do not rebuild):** Interviews + extended KYC states, ops Analytics,
  Staff & Roles, App Releases, SEO, Razorpay, RLS security (**PR #11**); Media
  Library, thumbnails, content revisions, CMS sync (**PR #16**).
- **No fabricated/mock data in the admin UI**: every live page uses the real backend
  BFF proxy. The only non-real admin pages are **three explicit `EmptyState`
  stubs**: Customers, Media Library, SEO (the latter two become real via PR #16/#11).

---

## 2. Architecture overview

```
customer-app (Expo RN) ─┐
pandit-app   (Expo RN) ─┤
website      (Next 15) ─┼──HTTPS──▶ FastAPI backend ──▶ Postgres/PostGIS (Supabase prod)
admin CRM    (Next 15) ─┘            (app/ + app/marketplace/)   + private KYC/media storage
```

- **Backend** — FastAPI, async SQLAlchemy 2.0, Alembic. Two cohabiting domains:
  - `backend/app/` — the **CMS** (services, categories, locations, testimonials,
    FAQs, pages, homepage banners, settings, enquiries, media) + admin auth + audit.
  - `backend/app/marketplace/` — the **marketplace** (`mp_*` tables): accounts,
    bookings, dispatch, finance, reviews, support, notifications, geo.
  - Routers mounted in [`backend/app/main.py:82`](../../backend/app/main.py). Admin
    marketplace APIs under `/api/v1/mp/admin/*`; CMS admin under `/api/v1/admin/*`.
- **Admin CRM** — Next.js 15 App Router. Two independent modules behind one shell:
  **Website Management** (`admin/(website)/*`) and **App & CRM**
  (`admin/(app)/marketplace/*`), driven by
  [`frontend/src/config/admin-nav.ts`](../../frontend/src/config/admin-nav.ts). All
  admin pages fetch through a same-origin BFF proxy (`/api/backend/...`,
  `frontend/src/lib/api.ts:30`) that attaches the access token — **no admin page
  talks to a third party and none ships hardcoded data.**
- **Auth** — Customers/pandits: phone + OTP → JWT with a `kind` claim
  (`marketplace/principals.py`). Staff: existing email/password admin login; role
  read from `admin_user.role`.
- **Geo** — dev uses haversine (`marketplace/geo.py`); production PostGIS DDL is
  present and gated by `settings.geo_backend` (`geo.py:30`).
- **Money** — integer paise end-to-end; append-only ledger; mock gateway in dev with
  the **same trust boundary as prod** (signed webhook verified server-side,
  `finance.py:51`). PR #11 adds the Razorpay signature seam.

---

## 3. Reusable infrastructure inventory (build ON these, don't rebuild)

| Asset | Where | What it already gives you |
|-------|-------|---------------------------|
| **Marketplace data model** | `backend/app/marketplace/models.py` | `mp_customer`, `mp_customer_address`, `mp_pandit`, `mp_pandit_capability`, `mp_verification_document`, `mp_booking`, `mp_dispatch_attempt`, `mp_booking_event`, `mp_payment`, `mp_ledger_entry`, `mp_refund`, `mp_payout`, `mp_review`, `mp_support_ticket`, `mp_ticket_message`, `mp_notification`, `mp_otp_code`. DB-level concurrency invariants (partial unique indexes: one accepted offer per booking `models.py:228`, one open payment per booking `models.py:284`). |
| **Booking state machine** | `marketplace/constants.py:75` (`BookingStatus`) | 14 states incl. `DISPATCHING`/`ASSIGNED`/`TERMINAL` groupings; append-only `mp_booking_event` history. |
| **Dispatch engine** | `marketplace/dispatch.py` (626 LOC) | Candidate ranking, offer/expiry, accept race-safety, `manual_reassign`, no-partner handling. |
| **KYC / verification** | `admin.py:90-256`, `storage.py`, `models.py:146` | Status lifecycle, private file storage (never public URLs), audited KYC file streaming to verification-role staff only, verification decisions. |
| **Finance ledger** | `marketplace/finance.py` (376 LOC) | `commission_split` (env-configurable %), signed-webhook `record_paid`, append-only ledger, partial/over-refund-safe `create_refund`, `process_payout` (lock-safe), `summary`. |
| **RBAC seam** | `marketplace/principals.py:116` (`require_staff`) + `StaffRole` | Every admin route is role-gated (ops/verification/finance/support/marketing/super-admin). Suspension revokes access immediately (re-read from DB). |
| **Audit log** | `app/services/audit.py` + `app/models/audit.py` | Append-only actor/entity/ip/meta rows; already written on every high-impact action (verification, reassign, refund, payout, moderation, ticket updates). `MpAudit` action catalog in `constants.py:162`. |
| **Notifications (in-app)** | `marketplace/notify.py` + `mp_notification` | `notify_customer`/`notify_pandit` feed; already fired on payment/refund/payout/support. Transport (push/SMS/email) is the layer to add. |
| **Geo / PostGIS** | `marketplace/geo.py` + migration `c3e6a9f1d4b7` | Haversine (dev) + PostGIS geography/GiST (prod), swappable by setting. |
| **Live tracking** | `customer.py:307` (`/tracking`), `pandit.py:302` (`/location`), `admin.py:332` | Partner heartbeat + live lat/lng + ETA, already surfaced in booking detail. |
| **CMS** | `backend/app/api/routers/admin_*` + `admin/(website)/*` | Full CRUD for services, categories, locations, testimonials, FAQs, pages, homepage, settings, enquiries, media upload. Draft/publish lifecycle (`core/constants.py:ContentStatus`). |
| **Admin shell & nav** | `frontend/src/config/admin-nav.ts`, `AppShell`, `AdminAuthGate` | Two-module nav, auth gate, icon registry, active-route logic — new CRM pages slot straight in. |
| **BFF data path** | `frontend/src/lib/api.ts`, `features/*/api.ts` | Token-attaching proxy + thin typed feature-API wrappers; the pattern for every new CRM page. |
| **Tests** | `backend/tests/*` (122 passing on `release/full`) | Marketplace, finance, concurrency, geo/PostGIS, support, verification, audit coverage. |

---

## 4. Per-module gap analysis

Legend: **Implemented** · **Partial** · **Missing** · **Broken** · **In-flight (PR#)**.
"UI" = admin CRM front end; "API" = backend. File refs are current `main` unless a PR
is named.

### Operations & command center

| Module | Status | Evidence / what exists | What's needed to complete |
|--------|--------|------------------------|---------------------------|
| **Dashboard** | **Implemented** | API `GET /mp/admin/dashboard` (`admin.py:398`); UI live 15s poll (`marketplace/page.tsx`). | Richer KPI tiles/date ranges; fold in Analytics (PR #11). |
| **Live Operations** | **Missing** | Data exists (bookings by status, dispatching states, live partner loc) but no real-time ops console (active bookings, stuck-dispatch alerts, SLA timers). | New ops console page; reuse dashboard + dispatch data; consider SSE/websocket or short-poll. |
| **Live Service Map** | **Missing** | Per-booking live partner lat/lng + ETA exist (`admin.py:332`); no map view of partners/bookings across a city. | New map page (partner/booking markers, heatmap); needs a bulk live-location endpoint. |
| **Analytics** | **In-flight (PR #11)** | `GET /mp/admin/analytics?days=N` (real booking trends) + `marketplace/analytics/page.tsx` + nav item. | Merge #11; extend with finance/partner cohorts; exports. |

### People

| Module | Status | Evidence / what exists | What's needed to complete |
|--------|--------|------------------------|---------------------------|
| **Customers** | **Missing (UI)** | Full customer data + addresses + bookings + reviews + tickets in API; **admin page is a stub** (`customers/page.tsx:12` `EmptyState "arrives in the next phase"`). | Customer list/search, 360 profile (bookings, spend, addresses, tickets), suspend/reactivate (status field already exists). High value, low risk — all data present. |
| **Partners** | **Implemented** | `GET /mp/admin/pandits`, detail, capability counts; UI list + detail + status filters (`partners/page.tsx`). | Partner 360 (earnings, ratings, reliability `offers_received/accepted`), bulk ops, suspension reasons. |
| **KYC & Verification** | **Implemented** | Private doc storage, audited file viewer (`admin.py:164`), decisions (`admin.py:222`). Base states: draft→submitted→under_review→action_required→approved/rejected/suspended. | KYC document-type policy (which docs mandatory), re-verification workflow. |
| **Interviews** | **In-flight (PR #11)** | PR #11 adds `interview_scheduled`, `interview_completed`, `reverification_required` states + `schedule_interview`/`complete_interview` decisions (`admin.py:76` on `release/full`). | Merge #11; add interview scheduling UI (calendar/notes). |
| **Staff** | **In-flight (PR #11)** | `/api/v1/admin/staff` (list/update role, super-admin only, lockout guards) + `admin/(website)/staff/page.tsx`. | Merge #11; invite flow; per-module permission matrix UI. |

### Operations — bookings & catalog

| Module | Status | Evidence / what exists | What's needed to complete |
|--------|--------|------------------------|---------------------------|
| **Bookings** | **Implemented** | List + detail + manual reassign + live tracking + dispatch-attempt/event history (`bookings/page.tsx`, `bookings/[id]/page.tsx`). | Bulk filters/export, admin-side cancel with reason, scheduled-booking view. |
| **Services & Categories** | **Implemented** (enhanced by PR #16) | Full CRUD (`services/page.tsx`, `categories/page.tsx`). PR #16 adds thumbnails, draft/publish, sort/paginate, preview. | Merge #16; no duplication — extend, don't rebuild. Add service image field (currently absent, see §6). |
| **Service Areas** | **Missing** | Only per-partner `service_radius_km`; discovery `/serviceability` (`discovery.py:117`) checks reachability, but no managed zones/pincodes. CMS `locations` are **website SEO pages**, not operational areas. | New service-area/zone model + serviceability rules + per-area toggles. **Business decision:** radius vs zone/pincode. |
| **Pricing** | **Partial** | Flat `price_paise` per service (or "on request"); commission % in settings. | Pricing rules (zone/time/surge), cancellation/no-show charges. **Business decisions** needed. |
| **Samagri** | **Missing** | Only `service.samagri: list[str]` (informational inclusions, `models/service.py:32`). | Managed samagri catalog + optional add-on ordering/inventory, if productized. |

### Finance

| Module | Status | Evidence / what exists | What's needed to complete |
|--------|--------|------------------------|---------------------------|
| **Payments** | **Implemented** | `mp_payment`, signed-webhook `record_paid`, idempotent; finance UI lists payments. PR #11 adds Razorpay signature verification. | Merge #11; reconcile against real Razorpay; payment search/export. |
| **Partner Earnings** | **Partial** | Partner-payable ledger entries per booking + `outstanding_by_pandit`; pandit app shows earnings. | Dedicated partner-earnings CRM view (statements, per-period breakdown). |
| **Payouts** | **Implemented** | `process_payout` (lock-safe, audited) + UI "Pay out" per partner (`finance/page.tsx`). | Scheduled payout cycles, batch payouts, provider integration. **Business decision:** payout cadence. |
| **Refunds & Disputes** | **Partial** | Refunds fully built (partial/over-refund safe, reason required, audited). **Disputes/chargebacks: none.** UI does full-refund only (partial supported in API). | Surface partial refunds; add dispute/chargeback case model + workflow. |
| **Invoices & Tax** | **Missing** | No invoice generation, no GST/tax module (`invoice`/`tax` = 0 refs). | Invoice generation (customer + partner), GST config, downloadable documents. |
| **Financial Ledger** | **Implemented (API)** | Append-only `mp_ledger_entry` with 6 entry types + `summary` (`finance.py:352`). `paymentLedger` endpoint exists but **UI never calls it** (no drill-down). | Ledger drill-down + export UI; reconciliation reports. |

### Engagement & platform

| Module | Status | Evidence / what exists | What's needed to complete |
|--------|--------|------------------------|---------------------------|
| **Reviews & Ratings** | **Implemented** | `mp_review` + rating aggregates on pandit; moderation hide/unhide UI (`reviews/page.tsx`). | Surface `reported` flag/filter; partner rating analytics. |
| **Support** | **Implemented** | Tickets, assign, reply, resolve (with resolution note), notify opener (`admin_support.py`, `support/page.tsx`). | Surface escalate/close transitions (statuses exist); SLA timers, canned replies. |
| **Notifications** | **Partial / In-flight (PR #11)** | In-app feed built + fired on key events. PR #11 adds push-token registry + MSG91 SMS adapter; **transport/delivery deferred**. | Real push/SMS/email delivery worker; templates; admin broadcast. **Business decision:** provider + spend. |
| **Marketing & Offers** | **Missing** | No coupon/discount/campaign engine (`coupon`/`discount` = 0 refs). Website banners/testimonials are CMS content only. | Offers/coupon model, campaign targeting, redemption tracking. |
| **Website CMS** | **Implemented** (sync fixed by PR #16) | Full CMS CRUD + draft/publish; PR #16 fixes admin→public revalidation sync + adds revisions + Sync & Activity page. | Merge #16; preserve as-is. |
| **App Management** | **In-flight (PR #11)** | `app_release` model (version, channel, force-update, checksum, notes) + `/api/v1/admin/app-releases` CRUD + `admin/(website)/releases/page.tsx`. | Merge #11; wire apps to version-check endpoint. |
| **Media Library** | **In-flight (PR #16)** | `media_asset` + `PublicMediaStore` + Pillow/WebP + MediaPicker + library page. Base `main` page is a stub (`media/page.tsx:12`). | Merge #16; do not rebuild. |
| **Platform Settings** | **Implemented** | `settings` CRUD (site/contact/social/SEO defaults; nav/footer raw-JSON). | Friendlier editors for nav/footer; marketplace-level config (commission, cycles) surfaced as settings. |
| **Roles & Permissions** | **Implemented (enforcement) + In-flight (PR #11 UI)** | `require_staff` enforces roles server-side on every admin route today; PR #11 adds the Staff & Roles management UI. | Merge #11; per-module permission matrix (SRS doc 22 defines the target). |
| **Audit Logs** | **Implemented (API)** | Append-only `audit_log`, written everywhere; `MpAudit` catalog. **No admin viewer UI yet.** | Audit-log viewer/search/filter page (data already there). |
| **System Health** | **Partial** | `/health`, `/health/db` (`main.py:61`); PR #16 adds a sync-status endpoint + startup warnings. | Admin system-health panel (DB, queues, provider status, sync). |

---

## 5. CRM ↔ app integration matrix (grounded in real endpoints)

What the apps/website consume today, and the CRM surface that governs it.

| Business object | Customer app | Pandit app | Website | CRM governs via |
|-----------------|-------------|-----------|---------|-----------------|
| Service catalog | discovery `/services` | — | `/public/*` (ISR) | Services/Categories CMS (+ PR #16 thumbnails) |
| Serviceability | `/discovery/serviceability` | — | — | *Service Areas (Missing)* |
| Partner discovery | `/discovery/pandits` | — | — | Partners/KYC |
| Booking lifecycle | `/mp/customer/bookings*` (create/list/detail/events/**tracking**/cancel) | `/mp/pandit/booking-requests`, accept/reject, `/bookings/{id}/status` | — | Bookings console + dispatch |
| Live GPS | `/customer/bookings/{id}/tracking` | `POST /pandit/location`, `/heartbeat` | — | *Live Service Map (Missing)*; booking detail (exists) |
| Onboarding/KYC | — | `POST /pandit/onboard`, `/verification`, doc upload | — | KYC & Verification (+ Interviews PR #11) |
| Availability | — | `PATCH /pandit/availability` | — | Partners / Live Ops |
| Payments | `POST /bookings/{id}/pay` + webhook | — | — | Finance (payments/ledger) |
| Earnings/payout | — | earnings view in app | — | Partner Earnings / Payouts |
| Reviews | `POST /bookings/{id}/review` | rating aggregate | public ratings | Reviews moderation |
| Support | `/customer/support/tickets*` | `/pandit/support/tickets*` | — | Support console |
| Notifications | `/customer/notifications` | `/pandit/notifications` | — | Notifications (transport = PR #11 + worker) |
| App version | version check (target) | version check (target) | — | App Management (PR #11) |

---

## 6. Mock / placeholder & disconnected UI (flagged for cleanup)

Confirmed by code read — **there are no fabricated data arrays**; these are the exact
gaps to close:

- **Pure stubs (`EmptyState`, zero backend):** Customers (`customers/page.tsx:12`),
  Media Library (`media/page.tsx:12` — real via PR #16), SEO (`seo/page.tsx:12` —
  real via PR #11).
- **Partial:** Enquiries — `admin_notes` is accepted by the API and typed, but the UI
  never renders/edits it (`features/enquiries/api.ts:9,28`); no pagination UI.
- **Unused-but-present backend capability (wire up, don't rebuild):**
  - `mpApi.paymentLedger(id)` exists (`api.ts:213`) — no ledger drill-down UI.
  - Partial-refund `amount_paise` supported (`api.ts:215`) — UI does full refunds only.
  - `Review.reported` typed (`api.ts:153`) — no reported filter/badge.
  - Ticket `escalate`/`close` statuses exist — UI exposes `resolved` only.
  - Services `page`/pagination param — list forces `page_size=100`.
  - **Service has no image field** in payload/form (despite CMS copy implying inline
    service images) — reconcile with PR #16 thumbnails.

None of these are production-data leaks; the docs here contain **no secrets or real
records**.

---

## 7. Proposed PR roadmap (under `feat/enterprise-crm-operations`)

Principle: **land the two open PRs first** (they unblock KYC/analytics/security/media),
then ship module-wise CRM PRs that reuse existing APIs before adding net-new backend.
Each PR is small enough to review in one sitting and sequenced by dependency.

### Pre-req (not new work — merge in order)
- **PR-A: merge #16** (CMS sync + Media Library + thumbnails + revisions). Run
  migration `d4f7b1a9c2e8` + revalidation env per `docs/cms-sync/README.md`.
- **PR-B: merge #11** (KYC interview states, analytics, staff, releases, Razorpay,
  RLS). ⚠️ Carries prod migration `e7a1b2c3d4f5` + RLS — **approval-gated** (DB +
  production + RBAC + payments). Follow `docs/production/PROD-MIGRATION-RUNBOOK.md`.
- Resolve the #11/#16 file overlap (§9) at second-merge.

### Recommended first implementation PRs (after #16/#11 land)

| PR | Title | Depends on | Reuses | New backend? | Approval gate |
|----|-------|-----------|--------|--------------|---------------|
| **1** | **Customers CRM** (list, search, 360, suspend) | #11 (RBAC) | `mp_customer*`, bookings, reviews, tickets APIs | Thin read endpoints + suspend action | Low (no money/KYC) |
| **2** | **Live Operations console** | #11 (analytics) | dashboard, bookings, dispatch, live-loc | Bulk live-location + active-ops endpoint | Low |
| **3** | **Audit-log viewer + Roles matrix UI** | #11 (staff) | `audit_log`, `require_staff` | Audit search endpoint | Medium (RBAC surface) |

Rationale: PR 1 is the highest value-to-risk item (all data exists, zero money/KYC
risk, closes the most visible stub). PR 2 is the "Rapido-style" ops differentiator and
reuses live-tracking already built. PR 3 makes the platform governable and auditable —
a foundation other finance/KYC PRs lean on.

### Later phases (sequenced)
- **Phase 4:** Bookings deepening (admin cancel + cancellation charges → needs pricing
  decision), Live Service Map.
- **Phase 5:** Service Areas + Pricing rules + Samagri (each its own PR; business
  decisions first).
- **Phase 6:** Finance ops — partial-refund UI, ledger drill-down/exports, Disputes,
  scheduled payouts. **Approval-gated.**
- **Phase 7:** Invoices & Tax (GST). **Approval-gated (financial/legal).**
- **Phase 8:** Reviews/Support deepening (reported filter, escalate/close, SLA).
- **Phase 9:** Notification delivery worker (push/SMS/email) + Marketing/Offers.
  **Approval-gated (real notifications, spend).**
- **Phase 10–12:** Analytics exports, platform settings surfacing, go-live hardening.

### Dependency graph (condensed)
```
#16 ─┐
     ├─▶ (CRM shell ready) ─▶ PR1 Customers ─▶ PR8 engagement
#11 ─┘                     ├─▶ PR2 Live Ops ─▶ Live Map
                           └─▶ PR3 Audit/Roles ─▶ Finance(6)/Invoices(7)/Notif(9)
Pricing decision ─▶ Service Areas(5) + Cancellation charges(4) + Pricing(5)
```

---

## 8. Items needing a **business decision** (do not hardcode)

Each must be an explicit, configurable product decision — defaults in code are
placeholders, not policy:

1. **Commission %** — default `15.0` (`config.py:91`). Final rate(s), per-service/zone?
2. **Gateway fee %** — default `2.0` (`config.py:92`). Pass-through or absorbed?
3. **Payout cycle** — currently on-demand/manual. Daily/weekly? Minimum threshold?
4. **Cancellation / no-show charges** — currently none. Who pays, how much, when?
5. **KYC document policy** — which documents are mandatory; retention period.
6. **Refund policy & dispute SLA** — auto vs manual; response/resolution targets.
7. **Serviceability model** — per-partner radius (today) vs city/zone/pincode zones.
8. **Notification provider & spend** — push + SMS provider, budget, opt-out policy.
9. **Tax/GST** — registration, invoice format, who is invoiced (customer/partner).

---

## 9. Merge-order note for the two open PRs

PR #11 and PR #16 are independent features that both touch:
`backend/app/api/routers/admin_media.py`, `backend/app/models/media.py`,
`frontend/src/app/admin/(website)/media/page.tsx`,
`frontend/src/config/admin-nav.ts`.

- They do **not** conflict logically — #16 is the Media *Library* (assets, thumbnails,
  Pillow) and CMS sync; #11's media touch is lighter. The nav additions are a **union**
  (Media Library, SEO, App Releases, Staff & Roles, Analytics).
- Whichever merges second needs a trivial re-resolve: keep both media models/routes
  (reconcile table/column overlap) and the union of nav items. Re-run the backend test
  suite after (both PRs ship green: #16 = 72 passing, #11 = 122 passing on their
  branches).
- Preserve intact: CMS sync (#16), production-security/RLS (#11), mobile redesign
  (#14/#15), build config (#12), Panditji branding (#13).

---

## 10. Constraints honored by this audit

- **Read-only:** no feature code, migrations, deployments or production data touched.
- **Reuse-first:** the roadmap extends existing APIs/CMS; it explicitly does not
  propose rebuilding the service catalog, CMS, dispatch, finance ledger or RBAC.
- **In-flight credited:** PR #16 and #11 deliverables are marked In-flight, not
  Missing.
- **No secrets:** no credentials, tokens or real customer/partner records appear here.
