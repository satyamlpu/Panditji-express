# 03 — Product Feature Matrix

Every major feature, classified by evidence. Legend: ✅ IMPLEMENTED · 🟡 PARTIAL · 🖥️ UI ONLY · ⚙️ BACKEND ONLY · 🔌 NOT CONNECTED · ❌ NOT IMPLEMENTED · 🔴 BROKEN · ⛔ BLOCKED.

## Discovery & content
| Feature | State | Evidence |
|---|---|---|
| Service catalogue (list/detail, price, category) | ✅ | `backend/app/content/*`, `/api/services`; website `(site)/puja-services`, `/book/[slug]` |
| Locations / city pages | ✅ | content locations API + `(site)/locations` |
| Testimonials, FAQs, CMS pages | ✅ | content models + admin CRUD; rendered on site |
| Search (puja/location/date) | 🟡 | `HeroSearch.tsx` routes to booking; no backend search index — client select only |
| Featured / category filtering | ✅ | `is_featured`, `category` on `ServiceListItem` |

## Accounts & auth
| Feature | State | Evidence |
|---|---|---|
| Admin/staff login (email+password, JWT) | ✅ | `marketplace/auth`, argon2id, access/refresh; verified live |
| Customer OTP login | ⛔ | code path exists; **no SMS provider**, `dev_code` suppressed in prod → cannot complete |
| Pandit OTP login | ⛔ | same as above |
| Refresh-token rotation + revocation | ✅ | implemented, tested |
| RBAC roles (staff) | 🟡 | `StaffRole` + `audit()` exist; **not enforced per-endpoint** everywhere |

## Booking lifecycle
| Feature | State | Evidence |
|---|---|---|
| Create booking (on-demand) | ✅ | `marketplace/routers/bookings.py`, dispatch engine |
| Dispatch / offer to pandits | ✅ | `dispatch.py` candidate ranking (haversine/PostGIS) |
| Atomic accept (no double-accept) | ✅ | `accept_offer` row lock + partial unique index; concurrency test on PG |
| **Scheduled booking auto-dispatch** | ❌ | bookings store a schedule but **no worker/cron** fires dispatch |
| Booking status tracking | ✅ | status enum + transitions; admin booking detail |
| Cancellation / reschedule | 🟡 | cancel paths exist; customer-facing reschedule limited |
| Reviews & ratings | ✅ | review model + endpoints; shown on site when real |

## Payments & finance
| Feature | State | Evidence |
|---|---|---|
| Payment intent / order | ⚙️🟡 | `payments.py` **mock** provider; HMAC webhook; no real gateway |
| Ledger / settlement | ✅ | `finance.py` `record_paid`, locked rows |
| Refunds | ✅ | `create_refund` with `refresh(with_for_update)`; over-refund fixed + tested |
| Payouts to pandits | ✅ | `process_payout` locks unsettled entries |
| Payment reconciliation UI | 🟡 | finance admin reads exist; reconciliation workflow thin |

## Real-time & tracking
| Feature | State | Evidence |
|---|---|---|
| Pandit location / GPS tracking | 🟡 | tracking endpoints + tests; **no realtime gateway** (polling only) |
| Live map for customer | 🖥️❌ | no websocket/push; not wired end-to-end |
| Geo matching (distance) | ✅ | haversine default; PostGIS `ST_DWithin` path behind flag |

## Mobile apps
| Feature | State | Evidence |
|---|---|---|
| Customer app (Expo) | 🔌 | `customer-app/` code present; **not built/published**, login blocked |
| Pandit partner app (Expo) | 🔌 | `pandit-app/` code present; **not published** |

## Admin CMS/CRM
| Feature | State | Evidence |
|---|---|---|
| Content CMS (services/pages/faqs/etc.) | ✅ | admin routes, verified live |
| Marketplace ops dashboard | ✅ | `admin/marketplace` + `mpApi.dashboard()` |
| Partner verification / KYC | ✅ | workflow present |
| Customer CRM | 🟡 | directory/list; deep profiles pending |
| Media library / SEO engine | 🖥️ | placeholders only |

## Platform / infra
| Feature | State | Evidence |
|---|---|---|
| Health/readiness endpoints | ✅ | `/health`, `/health/db` |
| Backups / DR | ❌ | none configured |
| Monitoring / error tracking | ❌ | none |
| CI | ✅ | `.github/workflows/ci.yml` (PG + frontend) |
| Custom domain | 🔴 | `panditjiexpress.com` serves empty 200 |

**Totals (indicative):** ✅ ~18 · 🟡 ~9 · ⚙️/🖥️/🔌 ~6 · ❌/🔴/⛔ ~7. The transactional core is real; the gaps are delivery (SMS), scheduling (worker), realtime, and ops infra.
