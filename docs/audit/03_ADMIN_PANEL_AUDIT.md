# 03 — Admin Panel Audit

Admin lives in `frontend/src/app/admin/`. It was recently restructured (Cycle 1–2) into an **Admin Control Center** (`/admin`) that branches into two independent module shells with separate sidebars and route namespaces:
- **Website Management** — route group `(website)`, home `/admin/website`.
- **App & CRM** — route group `(app)`, home `/admin/marketplace`.

Shell: collapsible sidebar (250/76px) + topbar (module switcher, breadcrumbs, search UI, notifications, profile), centralized Lucide icon registry (`components/admin/icons.tsx`), reusable kit (`components/admin/kit.tsx`, `charts.tsx`), token-driven theme (brand Yellow/Burgundy/Green). Auth via `AdminAuthGate` per module layout; BFF session. This satisfies most of the spec's "separate Website CMS / App CRM workspaces" requirement **today**.

## Feasibility of the proposed 3-workspace structure
**Verdict: highly feasible, low risk.** Two of the three workspaces already exist as independent route-group shells; adding a third ("Platform Governance") is additive — a new `(platform)` group + layout reusing the same `AppShell`, nav config, and kit. No backend change needed to *scaffold* it; the governance *data* (DB health, backups, integration health) is where the real work is.

## Workspace 1 — Website CMS (route group `(website)`)
| Module | Route | Backend API | Completeness | Missing |
|---|---|---|---|---|
| Dashboard | `/admin/website` | services/enquiries APIs | Done | — |
| Services | `/admin/services` (+ new, [id]/edit) | `/api/v1/admin/services` | Done | — |
| Categories | `/admin/categories` | `/api/v1/admin/categories` | Done | — |
| Locations | `/admin/locations` | `/api/v1/admin/locations` | Done | — |
| Pages | `/admin/pages` | `/api/v1/admin/pages` | Done | revision history |
| Homepage | `/admin/homepage` | `/api/v1/admin/...` (homepage_section) | Partial | section reorder/enable, live preview, draft/publish per section |
| Testimonials / FAQs | `/admin/testimonials`, `/faqs` | admin APIs | Done | — |
| Banners | (model+API exist) | `/api/v1/admin/banners` | Partial | dedicated UI |
| Media Library | `/admin/media` | `/api/v1/admin/media` (upload) | **Placeholder** | grid, search, alt text, usage checks, object storage |
| SEO | `/admin/seo` | (meta on pages) | **Placeholder** | canonical/OG/sitemap/robots/structured-data editor |
| Navigation | — | — | **Missing** | menu/nav management |
| Enquiries | `/admin/enquiries` | `/api/v1/admin/enquiries` | Done | — |
| Settings | `/admin/settings` | `/api/v1/admin/settings` | Done | — |
| Publishing/Revisions | — | `status`/`published_at` columns | Partial (no revision history) | version history, scheduled publish |

## Workspace 2 — App CRM (route group `(app)`, `/admin/marketplace/*`)
| Module | Route | Backend | Completeness | Missing |
|---|---|---|---|---|
| Operations dashboard | `/admin/marketplace` | `GET /mp/admin/dashboard` | Done (now with charts) | — |
| Customers | `/admin/marketplace/customers` | — | **Placeholder** | no customer admin endpoint; directory/profile/history |
| Pandit partners | `/admin/marketplace/partners` | `/mp/admin/pandits` | Done | KYC doc viewer, payout history on profile |
| Verification | within Partners | verification decision API | Done | audit history view |
| Bookings | `/admin/marketplace/bookings` (+[id]) | `/mp/admin/bookings` | Done | — |
| Dispatch / reassign | booking detail | reassign API | Done | live dispatch board |
| Live tracking | booking detail | tracking API (polling) | Partial | realtime map |
| Finance | `/admin/marketplace/finance` | `/mp/admin/finance` | Done | reconciliation view |
| Payments/Refunds/Payouts | finance page | finance endpoints | Done | — |
| Reviews | `/admin/marketplace/reviews` | `/mp/admin/reviews` | Done | — |
| Support | `/admin/marketplace/support` | `/mp/admin/support` | Done | — |
| Pricing / commission | — | config (`commission_percent`) | Partial | per-service pricing UI |
| Availability / serviceability | — | discovery/serviceability API | Partial | admin controls |
| Notifications | — | notification table | **Missing (admin)** | compose/broadcast, delivery |
| Analytics | operations only | dashboard aggregates | Partial | trends, cohorts, reports |

## Workspace 3 — Platform Governance (proposed; not present)
Entirely **missing** as a UI and mostly missing as backend:
- Admin users + roles/permissions (admin_user + StaffRole exist; **no admin-user management UI**).
- Audit logs viewer (data exists in `audit_log`/MpAudit; no UI).
- Security monitoring, integration health, API monitoring, background-job monitoring, DB health, **backup status, incident management** — no backend for these; would require new observability/ops endpoints.
- System configuration (settings table exists; could host some of this).

## Recommended changes
1. Add the `(platform)` route-group shell now (cheap) with Admin Users + Audit Log viewers backed by existing tables.
2. Build the real Media Library (needs object storage — see `09`/`12`) and SEO editor.
3. Add Customer CRM endpoints + directory. Add KYC/payout tabs to the partner profile.
4. Permission-gate each workspace/module to roles (see `08` RBAC); hide nav items by role.
