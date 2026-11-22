# Pandit Ji Express — Full Platform Status Report

_As of 2026-11-20. Reflects `main` (all feature PRs #1–#7 merged). This report is grounded in the actual repository state, not plans._

---

## 1. What it is

A ride-hailing-style marketplace for booking **pandits (priests) for pujas**, launch region **Uttar Pradesh**. One FastAPI + Postgres backend powers **four surfaces**:

1. **Public website** (marketing + online booking) — Next.js
2. **Admin CRM / Control Center** (ops, CMS, finance) — Next.js
3. **Customer mobile app** — Expo / React Native
4. **Pandit (Partner) mobile app** — Expo / React Native

**Live deployment:** backend `panditji-express2.vercel.app` + frontend `panditjiexpress.com` (Vercel) on **Supabase Postgres**.

**Overall status:** the core product is **built and deployed end-to-end**. What remains is mostly **external provider integration** (real SMS, payment gateway, push delivery) and **production enablement** of the newest feature (KYC file storage) — all listed explicitly in §7–8.

---

## 2. Platform at a glance

| Layer | Stack | State |
|---|---|---|
| Backend | FastAPI, SQLAlchemy 2 async, Alembic, Postgres (SQLite dev), JWT, argon2 | ✅ Built, deployed |
| Admin CRM | Next.js 15 App Router, React 19, Tailwind, React Query | ✅ Built, deployed |
| Public site | Next.js 15 (SSR/ISR), Tailwind | ✅ Built, deployed |
| Customer app | Expo SDK 58, expo-router, RN 0.88 | ✅ Core built (Expo-web verified) |
| Partner app | Expo SDK 58, expo-router, RN 0.88 | ✅ Core built (Expo-web verified) |
| Data | **31 tables**, **9 migrations** | ✅ |
| Tests | **13 test files, 67 tests** (backend), green on Postgres CI | ✅ |
| CI/CD | GitHub Actions (Backend-PG + Frontend) + Vercel; **branch protection on `main`** | ✅ |

---

## 3. Backend — built modules

One modular-monolith backend. Endpoint groups (counts = routes):

**Marketplace (app/CRM) API**
- **Customer API** (18): auth OTP, discovery/search, booking create/track/cancel, addresses, notifications, support tickets, push-token registry.
- **Partner (Pandit) API** (18): OTP login, onboarding, availability/heartbeat/location, booking offers (accept/reject), active-booking status, **earnings**, **verification (submit docs + file upload + status)**, notifications, support.
- **Admin marketplace API** (9): dashboard, partner review + **KYC document review & private file download**, verification decisions, booking ops (reassign), customers.
- **Admin finance API** (8): finance summary, payments, ledger, refunds, payouts, finance report.
- **Admin support API** (5): tickets, assign, reply, status.
- **Discovery** (3), **Payments** (2, mock gateway in dev), **Auth** (2 OTP).

**Website/CMS + core API**
- **Public** (14): services, categories, locations, testimonials, FAQs, pages, homepage, enquiry submission, sitemap/SEO data.
- **Admin CMS**: services (5), categories (5), pages (5), locations (6), testimonials (4), FAQs (4), banners (4), enquiries (2), settings (2), media (1).
- **Auth** (5): login, refresh, logout, me, change-password.

**Data model (31 tables)** incl. `mp_booking`, `mp_booking_event`, `mp_dispatch_attempt`, `mp_pandit`, `mp_pandit_capability`, `mp_customer`, `mp_customer_address`, `mp_payment`, `mp_ledger_entry`, `mp_payout`, `mp_refund`, `mp_review`, `mp_support_ticket`, `mp_ticket_message`, `mp_verification_document`, `mp_notification`, `mp_otp_code`, plus CMS tables (service, category, location, page, faq, testimonial, homepage_section, setting, redirect, booking_enquiry), and `admin_user`, `audit_log`, `refresh_token`.

**Security hardening (P0 + follow-ups, done):** atomic accept/finance locks, append-only audit log with actor + verified client IP, suspended-pandit gate, partial unique indexes, production secret-guard (refuses boot on default JWT/webhook secrets), OTP hashed (HMAC) with pepper, BFF proxy with httpOnly cookie + token refresh, payment-webhook signature verification, independently verified (10 verification reports in `docs/audit/p0-verification/`).

---

## 4. Admin CRM (web) — built

Restructured into an **Admin Control Center + two modules** via Next.js route groups (URLs preserved):

- **Control Center** (`/admin`) — live counts, module cards.
- **Website module**: Dashboard, Services (+new/edit), Categories, Locations, Testimonials, FAQs, Pages, **Homepage builder**, Enquiries, Settings. _Placeholders:_ **Media Library** and **SEO** pages (shell + EmptyState only).
- **App & CRM module**: Operations dashboard, **Partners** (review + KYC docs + **View file**), Bookings (+detail with dispatch timeline), **Finance** (payments, ledger, refunds, payouts), Reviews (moderation), Support (tickets), Customers.
- Premium design pass partially in (MetricCard, inline-SVG charts in `components/admin/`).

---

## 5. Public website — built

Marketing + booking site: Home, About, How-it-works, Puja services (list + detail), Puja categories (detail), Locations (list + detail), Testimonials, FAQs, Contact, **Book flow** (`/book/[slug]`), and legal pages (privacy, terms, refund/cancellation). Content is CMS-driven from the admin.

---

## 6. Mobile apps — built

Both apps share a foundation: env-driven API base, request timeout + GET retry, SecureStore token storage (AsyncStorage fallback on web), hi/en i18n, offline banner, Sentry (DSN-gated).

**Customer app** — screens: Home/discovery, Bookings list, Booking detail (tracking), Notifications, Profile, Addresses, Book-a-puja (`/book/[slug]`), Login (OTP), Support + ticket detail.

**Partner (Pandit) app** — screens: Home, Jobs, **Earnings**, Profile, Login (OTP), Onboarding, Active job (`/job/[id]`), Notifications, Support + ticket, **Verification & KYC (submit docs + attach photo upload)**.

Verified by TypeScript + lint and run on **Expo Web**. Native device builds (and the image-picker native module) require an **EAS/dev build** — see §8.

---

## 7. Flagship flows — status

| Flow | Status |
|---|---|
| OTP auth (customer + partner) | ✅ Working. ⚠️ Dev returns the code in the response — **no real SMS/DLT provider yet**. |
| Discovery + booking create | ✅ |
| Dispatch / matching (nearest eligible pandit) | ✅ haversine (dev) + PostGIS option (prod) |
| Booking lifecycle + event timeline | ✅ |
| Payments + ledger (commission, gateway fee, partner payable, refund, payout) | ✅ ledger/flow complete. ⚠️ **mock gateway** — real Razorpay/PhonePe pending. |
| Finance: refunds, payouts, reports | ✅ |
| Reviews + moderation | ✅ |
| Support tickets (both apps + admin) | ✅ |
| **Pandit KYC verification (submit → review → approve)** | ✅ end-to-end, incl. **private file upload + gated audited admin download** |
| In-app notifications | ✅ |
| Push notifications | ⚠️ token **registry** done; **actual FCM/APNs delivery not implemented** |
| Live location/tracking | ✅ location ping + ETA (basic); not a full realtime map pipeline |

---

## 8. What is INCOMPLETE / pending

These are deliberate boundaries (external accounts/keys or infra), not bugs:

1. **Real SMS / OTP provider** — integrate MSG91/DLT (or similar). Today OTP is dev-only (code returned in the API response). _Needs: provider account + DLT template approval._
2. **Real payment gateway** — replace the mock with Razorpay/PhonePe. The verification + idempotency + ledger plumbing already matches a real provider. _Needs: gateway account + keys._
3. **Push delivery** — tokens are stored; implement FCM (Android) / APNs (iOS) sending. _Needs: FCM/APNs credentials._
4. **KYC file storage in production** — code is done and deployed, but prod still needs: (a) the `e1a2b3c4d5f6` **migration applied to prod Supabase**, (b) `STORAGE_BACKEND=supabase` + a **private bucket**. See `backend/docs/prod-migration-kyc-files.md`. _Until done, verification endpoints 500 in prod._
5. **Admin Media Library** — placeholder; needs object storage + upload UI + WebP/AVIF + usage checks.
6. **Admin SEO engine** — placeholder; canonical/OG/sitemap/robots/structured-data management.
7. **Full RBAC** — staff roles exist and gate sensitive endpoints + audit logging; the complete 8-role model and an admin role-management UI are not fully built.
8. **Mobile store builds** — apps run on Expo Web and are store-ready in code, but need **EAS dev/production builds** + store listings (native modules like the image picker require a dev build, not Expo Go).
9. **Scale / load testing** — **no load tests have been run**, so no verified "millions of users" capacity claim. Architecture supports horizontal scale (stateless API, Redis/Upstash rate-limit option, pooled Postgres), but the number is unproven until tested.
10. **Scheduled Database Backup workflow** — currently **failing** (seen 2026-11-19/20); needs a fix (unrelated to app code).

---

## 9. Deployment & CI/CD status

- **Deployed** to Vercel (two projects) + Supabase. Backend uses the Supabase transaction pooler; `greenlet` pinned (prod-only gotcha fixed).
- **CI:** GitHub Actions — `Backend (PostgreSQL)` (migrations + 67 tests on real Postgres) and `Frontend (lint · typecheck · build)`. Both green on `main`.
- **Branch protection on `main`** now **requires both checks** before merge (added 2026-11-20), so merges are gated on green.
- **Known CI flake:** the Frontend job occasionally fails on a `next/font` Google-Fonts fetch that does not reproduce on Vercel; a re-run clears it.
- ⚠️ **Migrations are NOT auto-run on deploy** — schema changes must be applied to prod Supabase by hand (runbook provided).

---

## 10. Testing & quality

- Backend: **67 tests across 13 files**, passing on SQLite (dev) and PostgreSQL (CI); `ruff` clean.
- Frontend: `tsc --noEmit` + `next lint` clean.
- Mobile: `tsc` + `expo lint` clean on both apps.
- Security: P0 hardening independently verified (10 reports); latest KYC-upload diff security-reviewed (header-injection issue found and fixed).

---

## 11. Bottom line

**Built and working:** the full marketplace — discovery, booking, dispatch, lifecycle, payments/ledger, finance ops, reviews, support, KYC verification with private file upload — across backend, admin CRM, public site, and both mobile apps, deployed with CI and branch protection.

**Before a real public launch, wire up:** SMS/OTP, payment gateway, push delivery, and finish prod enablement of KYC storage (migration + bucket) — items 1–4 in §8. Items 5–10 are enhancements/hardening that can follow.
