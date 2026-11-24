# Autonomous Execution — Status

_Branch: `feat/production-readiness` (off `main`). Not merged to `main`. No production infra touched._
_Last updated: 2026-11-22._

Classification: ✅ done & tested · 🟢 done, unverified · 🟡 partial · ⚪ not started · 🔴 broken · ⛔ blocked (external).

**Guiding finding:** the audit's "pending" list overstated the gaps. Several Phase-0 items were **already implemented** (rate limiter with Redis/Upstash + fail-open, applied across endpoints; backup script with integrity check + retention; Sentry DSN-gated; health checks). Per the rules these were **not rebuilt** — only genuine gaps were filled and the already-built pieces were tested/verified.

---

## Phase 0 — Critical infrastructure

| Task | Status | What was done / found | Evidence |
|---|---|---|---|
| 0.1 KYC production readiness | ✅ code / ⛔ prod enablement | Upload/download, private server-generated keys, path-traversal guards, MIME allowlist, size cap, **gated + audited** download, storage-failure handling (→502) all exist. Download **streams through the backend** — deliberately more private than a signed URL, so signed URLs were NOT added. Migration `e1a2b3c4d5f6` validated (upgrade+downgrade). Prod enablement (bucket + migration + env) is an external/ops blocker. | `backend/app/marketplace/storage.py`, `backend/docs/prod-migration-kyc-files.md`, `test_marketplace_verification.py` |
| 0.2 Database backup repair | ✅ | Backup was built; it only alarmed because `DATABASE_URL` secret is unset. Workflow now **skips cleanly on schedule** / fails loudly on manual dispatch. Added `ops/restore_drill.sh` and **verified backup→restore locally (PASS)**. | `.github/workflows/backup.yml`, `backend/ops/restore_drill.sh`, `backend/ops/backup_db.sh` |
| 0.3 Distributed rate limiting | ✅ | Already implemented (Redis + Upstash-REST + in-process, fail-open) and applied per-IP+phone (OTP), per-account (booking, password change), enquiry. Added the **missing tests**. Not rebuilt. | `backend/app/core/ratelimit.py`, `backend/tests/test_ratelimit.py` |
| 0.4 Monitoring | ✅ | Sentry already DSN-gated + health checks exist. Added the genuine gap: **request correlation IDs** (`X-Request-ID` honoured/generated/echoed), **structured request logging** with latency, Sentry scope tag. No body/secret content logged. | `backend/app/core/observability.py`, `backend/app/core/middleware.py`, `backend/app/main.py`, `test_ratelimit.py` (header tests) |

**Commits (this branch):** `412d888` (correlation IDs + structured logging + rate-limit tests), `3809b84` (backup graceful-skip + restore drill).

**Tests:** 68 passed / 6 skipped; `ruff` clean. Restore drill: PASS.

**External blockers (Phase 0):**
- ⛔ Set `DATABASE_URL` GitHub Actions secret (Supabase session-pooler/direct) to enable nightly backups.
- ⛔ Apply migration `e1a2b3c4d5f6` to prod Supabase + create private `kyc-private` bucket + set `STORAGE_BACKEND=supabase` (+ `SUPABASE_*`).
- ⛔ Set prod `REDIS_URL`/Upstash so rate limits are shared across instances.
- ⛔ Set `SENTRY_DSN` (backend + both apps) to activate error tracking.

---

## Phase 1 — Website app download system ✅ (feature complete)

| Piece | Status | Evidence |
|---|---|---|
| Release data model + migration | ✅ | `backend/app/models/release.py`, `alembic/versions/f2b3c4d5e6a7_app_release.py` (base→head validated) |
| Admin CRUD API (staff-gated, audited) | ✅ | `backend/app/api/routers/admin_releases.py`; `backend/tests/test_releases.py` |
| Public active-releases feed (safe projection, no fake links) | ✅ | `backend/app/api/routers/public.py` `GET /api/v1/public/app-releases` |
| Public `/download` page (both apps × Android/iOS, store/APK/TestFlight, accurate "coming soon", version/checksum, install help, FAQs, privacy/support) | 🟢 | `frontend/src/app/(site)/download/page.tsx`, `frontend/src/lib/serverApi.ts` |
| Admin "App Releases" screen (list, add, activate/deactivate, delete) + nav | 🟢 | `frontend/src/app/admin/(website)/releases/page.tsx`, `frontend/src/features/releases/api.ts`, `src/config/admin-nav.ts` |

Tests: 72 passed / 6 skipped (backend); frontend tsc + lint clean. Release channels: production→store listing, beta→APK/TestFlight (presentational). **No fake/placeholder download links** — a null `download_url` renders an accurate "coming soon".

**QR codes on `/download` ✅** (branch `feat/discovery-enrichment`): each real download link now renders a **server-generated SVG QR code** (via the `qrcode` lib, built in the async server component — no client JS) with a "Scan to open on your phone" caption, shown on ≥sm screens; "Coming soon" slots render none. Verified live. Real signed builds/store links still belong to Phase 9 (EAS) and are an external blocker until build + store accounts exist.

## Phase 2 — Partner onboarding (gap-fill) ✅

Registration + KYC + base approval (submitted → under_review → action_required →
approved/rejected/suspended) were **already implemented and tested** — not
rebuilt. The genuine gap was the brief's extended CRM approval lifecycle:
**interview scheduling/completion** and **re-verification**.

| Piece | Status | Evidence |
|---|---|---|
| New statuses: `interview_scheduled`, `interview_completed`, `reverification_required` | ✅ | `backend/app/marketplace/constants.py` (PanditStatus) |
| CHECK constraint widened (model + Postgres migration; SQLite via create_all) | ✅ | `backend/app/marketplace/models.py`, `alembic/versions/a7c8d9e0f1b2_pandit_interview_states.py` |
| Admin decisions: `schedule_interview` / `complete_interview` / `require_reverification` | ✅ | `backend/app/marketplace/routers/admin.py` (`_DECISION_STATUS`), `schemas.py` (VerificationDecision) |
| Non-approved states force offline + remain dispatch-ineligible | ✅ | existing endpoint logic; `test_partner_lifecycle.py::test_require_reverification_blocks_going_online` |
| CRM: partner filter + decision buttons for the new states | 🟢 | `frontend/src/app/admin/(app)/marketplace/partners/page.tsx`, `features/marketplace/api.ts` |

Tests: `test_partner_lifecycle.py` (2) — interview→approve path, re-verification blocks going online. Suite **74 passed / 6 skipped**; migration base→head OK; frontend tsc+lint clean.

## Phase 3 — Nearby discovery (verified + enriched ✅)
🟢 Already implemented: `GET /mp/discovery/pandits` returns distance, rating, languages for online in-range partners (`backend/app/marketplace/routers/discovery.py`); PostGIS `ST_DWithin` + GiST index tested. **Not rebuilt.**

**Enrichment (branch `feat/discovery-enrichment`, off the reviewed tip) ✅** — closed the noted gaps:
- Search results now carry **`eta_minutes`** (reuses the shared `app.marketplace.eta.eta_minutes` the offer flow already uses — straight-line distance over an avg urban speed; indicative, not routed), **`price_display`** (the requested service's catalogue price), and **`experience_years` + `specialisation`**.
- New nullable `experience_years` / `specialisation` columns on `mp_pandit` (migration `d5e2f3a4b6c7`, additive, up+down validated), set at onboarding (`PanditOnboard` + `/partner/onboard`) and exposed on the profile.
- Tests: `backend/tests/test_discovery_enrichment.py` (3) — ETA/price/profile in results, ETA grows with distance (nearest-first), onboarding persists the fields. Suite **100 passed / 6 skipped**; ruff clean.
- **Customer-app UI ✅** (`customer-app/src/app/book/[slug].tsx`): the "Available near you" cards now show the per-pandit ETA, experience and specialisation (alongside distance/rating/languages). Verified live on Expo web. A real-time/routed ETA still needs a maps provider (external).
- **Pandit-app onboarding ✅** (`pandit-app/src/app/onboard.tsx`): the onboarding form now captures **years of experience** and **specialisation** (both optional) and sends them to `/partner/onboard`, so pandits set what customers see. tsc + expo lint clean; the persist path is covered by `test_onboard_persists_experience_and_specialisation`.
- **Admin Partner CRM ✅** (`frontend/.../marketplace/partners/page.tsx`): the partner detail panel now shows experience + specialisation (the admin detail endpoint already returns them via `PanditOut`). Frontend tsc+lint+build clean.

## Phase 4 — Booking & dispatch (gap-fill) ✅
Instant + scheduled booking and concurrency-safe assignment already existed and were **not rebuilt**. The genuine gap was the brief's third booking type — **customer-selected pandit**:

| Piece | Status | Evidence |
|---|---|---|
| `booking.preferred_pandit_id` (nullable FK) + migration | ✅ | `backend/app/marketplace/models.py`, `alembic/versions/b8d0e1f2a3c4_booking_preferred_pandit.py` |
| `BookingCreate.preferred_pandit_id`; validated approved on create (409 otherwise) | ✅ | `backend/app/marketplace/schemas.py`, `routers/customer.py` |
| Dispatch offers the chosen pandit **first**, falls back to nearest-first | ✅ | `backend/app/marketplace/dispatch.py` `_rank_candidates`; `test_booking_preferred.py` |

Tests: chosen (farther) partner offered before a nearer one; unapproved selection rejected. Suite **76 passed / 6 skipped**; migration base→head OK.

**Customer-app UI ✅:** the booking screen (`customer-app/src/app/book/[slug].tsx`) now lets the customer **tap a nearby pandit to request them specifically** — the selected card highlights, and the booking is created with `preferred_pandit_id` (dispatch offers them first, falls back to nearest). Verified live on Expo web.

**Scheduled-booking dispatch ✅** — scheduled bookings are no longer stranded at `requested`:
- `POST /api/v1/mp/admin/scheduler/dispatch-due` finds scheduled bookings whose
  `scheduled_at` has passed (still at `requested`) and starts dispatch for each.
  Idempotent (a booking leaves `requested` as soon as dispatch starts), batch-capped.
  No background worker — meant to be polled by an external cron.
- Guarded by a shared `SCHEDULER_SECRET` (`X-Scheduler-Token` header, constant-time
  compare); **disabled (503) until the secret is set**, so it's safe by default.
- Tests: `backend/tests/test_scheduled_dispatch.py` (3) — due dispatched + future
  skipped + idempotent, disabled-without-secret 503, wrong/missing token 401.
- **Activation (ops, not code):** set `SCHEDULER_SECRET` and wire a cron (Vercel
  Cron / GitHub Action) to POST this endpoint every minute or two.

## Correction to the audit baseline
While working Phase 6 I found that **push-token registry, partner earnings, and the finance report are NOT on `main`** — they live in **open PR #5 (`backend-p4`)**, unmerged. The earlier `CURRENT-SYSTEM-AUDIT.md` listed them as present (carried over from a prior session summary); treat them as **pending-merge**, not shipped. No other audit items were affected (verified against the router/grep this session).

## Phase 5 — Integration
🟢 Inherently satisfied: every client already uses the one backend as source of truth (audit §10). Realtime is HTTP-poll today; a push/WebSocket upgrade is a Phase 8 architectural decision.

## Phase 6 — Production integrations (seams built; live activation blocked) ✅/⛔
Built the provider **abstractions** so go-live is a config switch; real adapters are env-gated and never called in tests.

| Piece | Status | Evidence |
|---|---|---|
| SMS/OTP provider abstraction (`none`/`console`/`msg91`) wired into OTP request | ✅ seam / ⛔ live | `backend/app/marketplace/sms.py`, `routers/auth.py`; `test_integrations.py` (code returned only when no provider delivered; hidden once a provider sends) |
| Payment provider seam + Razorpay signature verifiers (checkout + webhook) | ✅ seam / ⛔ live | `backend/app/marketplace/payment_providers.py`; `test_integrations.py` (deterministic HMAC round-trip). Ledger/idempotency flow untouched. |
| Settings: `sms_provider`+MSG91, `payment_provider`+Razorpay keys | ✅ | `backend/app/core/config.py` |
| Push sender | ⛔ deferred | Depends on the device-token registry in **open PR #5** — not duplicated here to avoid a merge conflict. Build after PR #5 merges. |

External blockers: MSG91 account + DLT template (SMS); Razorpay account + keys (payments); FCM/APNs + PR #5 merge (push). Tests: 82 passed / 6 skipped.

## Phase 7 — Admin CRM completion (RBAC UI ✅ · SEO ✅ · Media Library ✅)

RBAC was enforced server-side but had no management screen — now it does:

| Piece | Status | Evidence |
|---|---|---|
| Staff/roles API (list + assign role + enable/disable), **super-admin only**, audited | ✅ | `backend/app/api/routers/admin_staff.py`, `schemas/staff.py`; `test_staff.py` |
| Lockout guards: can't demote self; keep ≥1 active super-admin | ✅ | `admin_staff.py`; `test_staff.py::test_cannot_lock_out_self` |
| CRM "Staff & Roles" screen + nav | 🟢 | `frontend/src/app/admin/(website)/staff/page.tsx`, `features/staff/api.ts`, `src/config/admin-nav.ts` |

Tests: 86 passed / 6 skipped; frontend tsc+lint+build clean.

**Phase 7 SEO engine ✅** — settings-backed, admin-managed:
- Public `seo` settings key exposed (`backend/app/api/routers/public.py`), written via the existing audited settings API; `test_seo.py`.
- Site layout injects **Organization JSON-LD** + applies default OG image and a **global no-index** switch (pre-launch) via `generateMetadata`; `robots.ts` honors no-index. (`frontend/src/app/(site)/layout.tsx`, `src/app/robots.ts`)
- Admin **SEO screen** replaces the placeholder: title suffix, default description, OG image, no-index, Organization (name/logo/phone/sameAs). (`frontend/src/app/admin/(website)/seo/page.tsx`, `features/seo/api.ts`)
- Per-page titles/canonicals still override; sitemap already existed.

**Phase 7 Media Library ✅** (dev-complete; prod needs a public bucket/CDN):
- `MediaAsset` model + migration `c4d1e2f3a5b6` (base→head validated; up+down).
- Storage seam extended: `get_media_storage()` / `build_media_key()` reuse the
  same local/Supabase backends as KYC but a **separate dir/bucket**
  (`media-public`), plus a real `delete()` on both backends. Config:
  `media_storage_local_dir`, `supabase_media_bucket`, `media_max_upload_bytes`.
- Admin API (`app/api/routers/admin_media.py`, super-admin + audited): upload
  (image allowlist, SVG rejected, 3 MB cap), list with search, alt-text edit,
  and delete **gated by a usage check** (scans homepage images + settings JSON
  by the stable media path; 409 while referenced). The existing `POST` contract
  (`{url, path}`) is preserved, so the inline `ImageUpload` pickers keep working.
- Public **proxy** `GET /api/v1/public/media/{id}` streams bytes with a 1-year
  immutable cache header — works on ephemeral/serverless filesystems and can sit
  behind a CDN later (so no public bucket is strictly required for dev-complete).
- Admin **Media Library** screen (`admin/(website)/media/page.tsx`): upload grid,
  search, inline alt editing, copy-URL, delete — replaces the placeholder.
- Evidence: `backend/tests/test_media.py` (9 tests: upload/list/public-fetch,
  auth, 415, 413, alt, search, delete-usage-check 409→200, unknown-id 404).
  Verified **live** against the running backend (upload → proxy bytes identical
  → alt → search → delete → 404). `features/media/api.ts`.
- **Prod/infra follow-ups (⛔ external):** a public `media-public` Supabase bucket
  (+ `STORAGE_BACKEND=supabase`), a CDN in front of the proxy, and WebP/AVIF
  transform — an image pipeline that needs the bucket/CDN decision first.

## Phase 8 — Load testing (scripts authored) + Analytics ✅
k6 scripts written for the read path, OTP, and the full booking→dispatch flow, with
a README (targets, isolated-env-only warning, how to tune pool/Redis from results).
`backend/ops/loadtest/{read_path,otp_request,booking_flow}.js` + `README.md`.
**Not run** — needs an isolated/staging environment with resource limits (external).

**Operations Analytics ✅** (branch `feat/discovery-enrichment`) — real booking data, no new events table:
- `GET /api/v1/mp/admin/analytics?days=N` (ops-gated): daily booking trend
  (total + completed + no-partner, gaps zero-filled), top services, and window
  totals/rates (`completion_rate`, `no_match_rate`, GMV from completed-booking
  prices). Aggregated in Python → dialect-portable. `app/marketplace/routers/admin.py`.
- Admin **Analytics** screen (`admin/(app)/marketplace/analytics/page.tsx`, nav added):
  7/30/90-day selector, KPI tiles, a dependency-free inline-SVG daily column chart
  (completed shaded) and a top-services bar list (reuses `charts.tsx`).
- Tests: `backend/tests/test_marketplace_analytics.py` (3) — totals/daily/top +
  GMV, staff-gated 401, empty-window zeroed. Suite **103 passed / 6 skipped**;
  frontend tsc+lint+build clean.
- **Follow-up:** revenue reconciliation / payout analytics (finance module);
  conversion funnel once discovery→booking events are tracked.

## Phase 9 — Mobile builds ⛔
Blocked on Apple Developer + Google Play accounts (EAS build/submit). The website
`/download` + CRM App Releases already consume real builds once they exist.

## Phase 10 — Final production readiness ✅ (docs) / NO-GO
Written: `docs/production/GO-LIVE-CHECKLIST.md`, `RELEASE-PLAN.md`, `ROLLBACK-PLAN.md`,
`FINAL-TEST-REPORT.md`. **Recommendation: NO-GO for public launch** — code-complete
and well-tested, but launch-critical integrations (SMS/payments/push), prod data/
storage enablement, and a load test are outstanding. Full rationale + path-to-GO in
the test report. Nothing blocked is claimed production-ready.

## Summary of this execution (branch `feat/production-readiness`)
Phases delivered with tests/docs: 0 (infra), 1 (download+releases), 2 (partner
lifecycle), 4 (customer-selected booking), 6 (SMS/payment seams), 7 (RBAC UI +
SEO engine + Media Library), 8 (load scripts), 10 (go-live docs). Phase 3/5
verified already-built. Remaining: Phase 8 run + analytics, Phase 9 store builds,
and the external blockers. Backend 97 passed / 6 skipped; frontend tsc+lint+build
clean. Not merged to `main`; nothing deployed.

---

## Remaining risks
- No load-test evidence yet (Phase 8) — scale to 10M unproven.
- Frontend/mobile have no automated functional test suites.
- Production enablement (migrations-on-deploy, backup secret, KYC storage) is ops work requiring access this agent does not have.

## Next
Phase 1: release-management backend (model + migration + admin APIs + public active-releases endpoint + tests), then the public `/download` page + admin release screen with an accurate "unavailable" state (no fake links).

## Deployment prep (2026-11-24)
- **Android APKs built ✅** (EAS, @sbsharma3434): Customer + Partner, v1.0.0(1),
  internal-distribution APKs FINISHED. Build IDs cc39a027… / ed06aa01…; artifact
  URLs on expo.dev. Config on PR #12 (app IDs, eas.json, projectIds, Sentry-upload
  disabled). iOS: prebuild done, dev-build paused (CocoaPods link issue).
- **Prod migration preflight PASSED ✅** against Supabase `easvvosvjaiaqcjuggki`
  (PG 17.11). Prod @ `c3e6a9f1d4b7` → head `54a335ac54d9`. Dry-run = additive only
  (3 CREATE TABLE, 6 ADD COLUMN, 4 CREATE INDEX); the two flagged lines
  (ck_pandit_status recreate = widened superset; alembic_version DELETE = merge
  bookkeeping) verified safe. See PROD-MIGRATION-RUNBOOK.md. Nothing executed —
  migration + PR #11 merge await explicit approval.

## Security hardening (2026-11-24)
- **DB Data API lockdown ✅** — migration `e7a1b2c3d4f5` (Postgres-only, role-guarded):
  revokes `anon`/`authenticated` access to `public`, ALTER DEFAULT PRIVILEGES for
  future tables, RLS on all app tables. Fixes anon-readable marketplace/KYC tables.
  `tests/test_security.py` (13) + `docs/security/DATABASE-SECURITY-AUDIT.md`.
  Prod migration SQL regenerated (head c3e6a9f1d4b7 → e7a1b2c3d4f5). Nothing
  executed on prod — awaits explicit approval.
