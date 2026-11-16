# 07 — Admin CMS / CRM Audit

Next.js admin under `src/app/admin/`, restructured into **Control Center** `(center)` + two modules: **Website Management** `(website)` and **App & CRM** `(app)`. Auth-gated per group; `/admin/login` ungated. LIVE; login + reads/writes verified this session.

## Routes present (verified)
**Control Center:** `/admin` (two module cards + live counts).
**Website:** `website` (dashboard), `services` (+`new`, `[id]/edit`), `categories`, `locations`, `testimonials`, `faqs`, `pages`, `homepage`, `enquiries`, `settings`, `media`, `seo`.
**App & CRM:** `marketplace` (operations), `partners`, `bookings` (+`[id]`), `finance`, `reviews`, `support`, `customers`.

## State by area
| Area | State | Notes |
|---|---|---|
| Staff auth + gate | ✅ | argon2id + JWT; per-group `AdminAuthGate` |
| Content CMS (services/categories/locations/testimonials/faqs/pages) | ✅ | full CRUD, drives the live site |
| Operations dashboard | ✅ | `mpApi.dashboard()`, real `bookings_by_status` |
| Partner verification / KYC | ✅ | verify workflow present |
| Bookings list + detail | ✅ | status visible |
| Finance | 🟡 | reads/ledger views; reconciliation & payout UI thin |
| Reviews / Support | ✅ | list + moderate |
| Customers CRM | 🟡 | directory/list only; no deep profile/history/notes |
| Media library | 🖥️ | placeholder (no object storage) |
| SEO engine | 🖥️ | placeholder (no canonical/OG/sitemap engine) |
| Homepage builder | 🖥️ | route exists; not a full section-reorder/publish builder |

## Findings
| # | Severity | Finding | Evidence |
|---|---|---|---|
| A-1 | HIGH | **RBAC not enforced per-endpoint** — `StaffRole` + `audit()` exist but sensitive mutations aren't consistently role-gated server-side | see 13; backend routers |
| A-2 | MEDIUM | Media & SEO are **UI-ONLY placeholders** — no storage/engine behind them | `media/page.tsx`, `seo/page.tsx` |
| A-3 | MEDIUM | Customer CRM is a flat list — no history/notes/segments | `customers/page.tsx` |
| A-4 | MEDIUM | Finance reconciliation/payout workflow incomplete for real money ops | `finance/page.tsx`, 11 |
| A-5 | LOW | Homepage builder is a stub, not a publish/preview/versioned editor | `homepage/page.tsx` |
| A-6 | LOW | Token drift: some admin screens mix legacy `forest`/`gold` tokens with Brand v2.0 | globals/tailwind |

## Strengths
Clean modular shell (route groups keep URLs stable), Lucide icon registry, React Query + BFF token refresh, real partner-verification workflow, premium MetricCard/charts fed by **real** `bookings_by_status` (no fabricated time-series).

## Classification
Admin: **IMPLEMENTED and live** for content + core ops; **PARTIAL** for CRM depth, finance reconciliation, media/SEO; **key risk is server-side RBAC enforcement (A-1)**.
