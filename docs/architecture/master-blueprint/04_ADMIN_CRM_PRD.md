# 04 — Admin CRM / CMS PRD (Web)

**Current state:** Next.js admin at `/admin` (live). Two modules behind an **Admin
Control Center** (`admin/(center)/page.tsx`): **Website** (CMS) and **App & CRM**
(marketplace). Auth-gated per route group; staff RBAC enforced at the API. **[IMPLEMENTED]**

## Module inventory (requested) with status

### Executive Dashboard
- **[PARTIAL]** `marketplace/page.tsx` (operations) + control center show counts
  (`mpApi.dashboard()`): bookings, pending verifications, supply. Missing: revenue
  trend, serviceability map, operational alerts, time-series. Requires an analytics
  source (see 17/18).

### Customer CRM
- **[PARTIAL]** `marketplace/customers/page.tsx` — simple directory. Missing: profile
  depth, booking history view, complaints, **risk flags**, support history timeline.

### Partner CRM
- **[IMPLEMENTED (core)]** `marketplace/partners/page.tsx` — applications, KYC review,
  verification decision, suspension. Missing: performance scorecards, payout history
  per partner, document viewer with signed URLs.

### Booking Operations
- **[IMPLEMENTED (core)]** `marketplace/bookings/page.tsx` + `[id]` — search, detail,
  status, manual reassign. Missing: structured reschedule, escalation workflow, SLA
  timers.

### Dispatch
- **[PARTIAL]** manual reassign exists; **assignment queue / live offer monitoring**
  dashboard [MISSING]. Backend has the data (`mp_dispatch_attempt`).

### Finance
- **[IMPLEMENTED (core)]** `marketplace/finance/page.tsx` — payments, refunds,
  payouts, ledger view, commission. **Audited** (A-1 fix: one audit row per action
  with actor_id + IP). Missing: reconciliation against gateway, financial reports/export,
  **maker-checker** approvals.

### Support
- **[IMPLEMENTED (core)]** `marketplace/support/page.tsx` + admin_support router —
  tickets, assign, reply, status. Missing: **SLA tracking**, dispute structure,
  escalation tree.

### Website CMS
- **[IMPLEMENTED]** services, categories, locations, testimonials, FAQs, pages,
  homepage, media, SEO, settings, enquiries. Publishing + revalidate wired
  (`services/revalidate.py`). Missing: **blog**, media object-storage backing (current
  media is placeholder), SEO engine depth (structured data/sitemap automation),
  revision history.

### Staff Management
- **[PARTIAL]** staff roles exist in code (`StaffRole`), auth is DB-resolved. Missing:
  **admin UI to CRUD staff, assign roles, teams, session/access review** — today staff
  are seeded/DB-managed, not UI-managed.

### Analytics
- **[MISSING]** no funnel/conversion/retention/cohort analytics surface or pipeline.

### Security & Audit
- **[PARTIAL]** append-only `audit_log` captures staff/financial actions (broad
  coverage verified). Missing: an **admin audit-viewer UI**, security-event feed,
  access-change log view, suspicious-activity signals.

## Permission separation (requested)
CMS permissions **must** be separate from financial/operational — see
[22_ADMIN_PERMISSION_MATRIX](22_ADMIN_PERMISSION_MATRIX.md). Today: content routes are
super-admin-only (`require_admin`); marketplace mutations are role-scoped
(`require_staff(OPS|VERIFICATION|FINANCE|SUPPORT)`). **Gap:** content delegation roles
(MARKETING/CONTENT) not yet usable for CMS — deferred.

## Per-module requirements (apply to each)
- **Roles/permissions:** every module action maps to a role (matrix in 22).
- **Error/empty/loading states:** shared admin kit provides skeletons, empty, error,
  toasts (present).
- **Audit:** every sensitive mutation writes `audit_log` (present for finance/ops/
  verification/support/content).
- **Acceptance criteria:** deny-by-default (unauth→401, wrong role→403), object lookups
  validated, idempotent money actions, actor+IP recorded.

## Target additions [PROPOSED]
1. Staff & RBAC admin UI (roles, teams, sessions, access reviews).
2. Analytics module (needs event pipeline).
3. Dispatch live-ops board.
4. Finance reconciliation + maker-checker + reports.
5. Audit/security viewer.
6. CMS: blog, object-storage media, SEO engine, revision history.
