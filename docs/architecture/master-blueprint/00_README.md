# Pandit Ji Express — Master Product & Engineering Blueprint

**Status:** planning / inspection only. No implementation, no production change, no
deploy/merge/push is performed by this blueprint. Produced 2026-11-16.

This directory is a forward-looking, evidence-grounded blueprint for the full
three-app ecosystem (Customer app, Partner app, Admin CRM) + the existing public
website, with a staged path toward a 100M-registered-user target. It **extends**
the current system; it does not rewrite it.

## How to read this

Every claim about the current system is labelled with a **maturity tag**:

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Exists in the repo and is wired end-to-end (cited by file/module). |
| **[PARTIAL]** | Exists but incomplete, dev-only, or not production-wired. |
| **[MISSING]** | Not present; required for the target. |
| **[PROPOSED]** | New design in this blueprint. |
| **[BLOCKED]** | Cannot proceed without an external dependency/decision. |
| **[NEEDS-VALIDATION]** | Believed true but not verified here (e.g. load capacity). |

Unlabelled prose is design guidance. Capacity/scale numbers are **targets or
models, never measured capacity** — nothing here claims the system supports 100M
users; that requires load-test evidence that does not yet exist.

## Evidence base

This blueprint builds on the independently-produced current-state audit in
[`docs/audit/current-platform/`](../../audit/current-platform/) (21 reports) and
the P0 verification in [`docs/audit/p0-verification/`](../../audit/p0-verification/).
It does not restate those in full; it references them.

## Current stack (verified from the repo, 2026-11-16)

| Layer | Technology | Version (from manifests) |
|---|---|---|
| Backend | FastAPI (modular monolith), SQLAlchemy 2 async, Pydantic v2 | fastapi≥0.118, sqlalchemy[asyncio]≥2.0.43, pydantic≥2.11 |
| Auth | pyjwt (HS256), argon2-cffi | pyjwt≥2.10 |
| DB | PostgreSQL / Supabase (prod), SQLite (dev/CI); Alembic (8 migrations) | psycopg[binary]≥3.2, alembic≥1.14 |
| Web | Next.js App Router, React 19, Tailwind 3.4, TanStack Query | next^15.5.28, react 19.0.0, tailwindcss^3.4.17 |
| Mobile | Expo + expo-router, React Native | expo~58, react-native 0.88.1 **[PARTIAL — not deployed]** |
| Monitoring | Sentry (backend + web) | sentry-sdk≥2.0, @sentry/nextjs^8.55.2 **[PARTIAL — no DSN set]** |
| Hosting | Vercel (2 projects) + Supabase | panditjiexpress.com (web), panditji-express2 (API) |

## Document index

| # | Document | Covers |
|---|---|---|
| 01 | PRODUCT_STRATEGY | Vision, segments, business model, success metrics |
| 02 | CUSTOMER_APP_PRD | Customer mobile app product requirements |
| 03 | PANDIT_APP_PRD | Partner mobile app product requirements |
| 04 | ADMIN_CRM_PRD | Admin CRM/CMS product requirements |
| 05 | WEBSITE_INTEGRATION | Public website, its role and shared contracts |
| 06 | SYSTEM_ARCHITECTURE | Topology, boundaries, request/data flow |
| 07 | BACKEND_MODULES | Module responsibilities, interfaces, ownership |
| 08 | API_CONTRACTS | Endpoint inventory + contract conventions |
| 09 | DATABASE_ERD | Entities, relationships, constraints, indexes |
| 10 | IDENTITY_AND_RBAC | Principals, sessions, RBAC/ABAC model |
| 11 | SECURITY_ARCHITECTURE | Security as a platform capability |
| 12 | BOOKING_AND_DISPATCH | Booking + dispatch state machines |
| 13 | PAYMENT_AND_FINANCE | Payments, ledger, refunds, payouts |
| 14 | GPS_AND_REALTIME | Tracking + realtime architecture |
| 15 | NOTIFICATION_ARCHITECTURE | Multi-channel notifications |
| 16 | INFRASTRUCTURE_AND_DEVOPS | Environments, CI/CD, ops |
| 17 | 100M_SCALABILITY_PLAN | Staged scaling + capacity models |
| 18 | PERFORMANCE_AND_SLO | SLIs/SLOs, perf budgets |
| 19 | TESTING_AND_QA_STRATEGY | Test pyramid + release gates |
| 20 | BACKUP_AND_DISASTER_RECOVERY | Backup/restore, RPO/RTO |
| 21 | PRIVACY_AND_DATA_GOVERNANCE | PII, retention, DPDP alignment |
| 22 | ADMIN_PERMISSION_MATRIX | Role × resource × action matrix |
| 23 | IMPLEMENTATION_ROADMAP | P0–P10 dependency-aware plan |
| 24 | REQUIREMENTS_TRACEABILITY | Requirement → artifact mapping |
| 25 | RISK_REGISTER | Risks, severity, mitigations |
| 26 | ARCHITECTURE_DECISIONS | ADRs |
