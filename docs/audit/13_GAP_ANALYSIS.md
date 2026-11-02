# 13 — Gap Analysis (current vs target)

Legend: ✅ Implemented · 🟡 Partial · 🔴 Missing · ⚠️ Implemented-but-risky.

| Capability | State | Gap to close |
|---|---|---|
| **Identity & RBAC** | 🟡 | AuthN strong (JWT+refresh, OTP, argon2). Roles exist (`StaffRole`) + `require_staff` on admin. Gaps: no admin-user/role **management UI**, role→workspace/module gating not exhaustive, suspended-pandit gate missing (S5). |
| **Customer CRM** | 🔴 | No customer admin endpoint or directory; customers visible only inside bookings. |
| **Pandit CRM** | 🟡 | Partner list + verification workflow ✅. Missing: KYC-doc viewer, payout history, performance view on profile. |
| **Website CMS** | 🟡 | Services/categories/locations/pages/testimonials/FAQs/enquiries/settings ✅. Missing/partial: Homepage Builder (reorder/preview/section publish), Media Library (object storage), SEO editor, navigation mgmt, revision history. |
| **Marketplace core** | ✅ | Discovery, serviceability, booking, dispatch, tracking, payment, review all present for the happy path. |
| **Serviceability** | 🟡 | Endpoint exists; app-level geo only; no admin controls, no PostGIS. |
| **Booking engine** | ⚠️ | Immediate ✅; **scheduled dead** (R4); no idempotency (R5); no slot/conflict model. |
| **Dispatch engine** | ⚠️ | Works single-instance; **not atomic** (R1/S4); lazy expiry; no worker. |
| **Scheduling engine** | 🔴 | No scheduler/cron/worker; no availability-slot model. |
| **Pricing & commission** | 🟡 | Flat commission/gateway-fee config + paise math ✅; no per-service/dynamic pricing UI. |
| **Payment & ledger** | ⚠️ | HMAC webhook, integer paise, append-only ledger ✅; concurrency idempotency gaps (R2/R3), default-secret risk (S1), refund reconciliation gap. |
| **GPS tracking** | 🟡 | Server endpoints + freshness ✅ (polling); no realtime, no device-GPS/permissions wired, no purge-on-end, no retention policy. |
| **Notifications** | 🔴 | Table + records exist; **no delivery** (push/SMS), no admin compose/broadcast. |
| **Support & reviews** | ✅ | Tickets + messages + reviews (one-per-booking) implemented. |
| **Analytics** | 🟡 | Operations aggregates + charts ✅; no trends/cohorts/reports/warehouse. |
| **Audit & governance** | 🟡 | DB audit log + `audit()` service ✅; no viewer UI, no Platform Governance workspace, no integration/DB-health/backup monitoring. |
| **Caching** | 🔴 | None (Redis). |
| **Background jobs/queue** | 🔴 | None. |
| **Realtime** | 🔴 | None. |
| **Object storage / CDN** | 🔴 | Local disk only. |
| **Observability** | 🔴 | Minimal logging; no APM/metrics/alerts. |
| **CI/CD & containers** | 🔴 | None. |
| **Backups/DR** | 🔴 | None documented. |
| **Testing** | 🟡 | Good backend API/lifecycle tests; no concurrency/frontend/mobile/e2e/a11y/load. |
| **DB for scale** | ⚠️ | SQLite dev (Postgres wired, psycopg off); no PostGIS; no composite indexes; status enums uncheck-constrained; ledger FK gaps. |
| **Design system / admin UX** | ✅ | Control Center + 2 module shells, tokens, Lucide registry, responsive (Cycle 1–2). Governance workspace pending. |

## Highest-leverage gaps (close first)
1. **Transactional correctness** (atomic accept, webhook/refund/payout idempotency) + tests — protects data and money.
2. **Secret hardening** (S1) — cheap, blocks payment forgery.
3. **Postgres (+PostGIS) + Redis + job queue** — unblocks scale, scheduled bookings, real expiry, and realtime.
4. **DevOps baseline** (Docker + CI + backups + monitoring) — makes anything shippable safely.
5. **Object storage + Media Library**; **Customer CRM**; **Notifications delivery** — close the biggest functional holes.
