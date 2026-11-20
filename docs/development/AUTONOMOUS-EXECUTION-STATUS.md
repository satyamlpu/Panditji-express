# Autonomous Execution — Status

_Branch: `feat/production-readiness` (off `main`). Not merged to `main`. No production infra touched._
_Last updated: 2026-11-20._

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

**Not in scope this pass (documented):** QR codes on `/download` (a small enhancement — needs a QR renderer; deferred to avoid a new client dependency in this pass). Real signed builds/store links belong to Phase 9 (EAS) and are an external blocker until build + store accounts exist.

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

## Phase 3 — Nearby discovery (verified, minor gaps noted)
🟢 Already implemented: `GET /mp/discovery/pandits` returns distance, rating, languages for online in-range partners (`backend/app/marketplace/routers/discovery.py`); PostGIS `ST_DWithin` + GiST index tested. **Not rebuilt.** Minor future gaps (not blockers): per-result ETA + price estimate, experience/specialisation fields in the search item.

## Phase 4 — Booking & dispatch (gap-fill) ✅
Instant + scheduled booking and concurrency-safe assignment already existed and were **not rebuilt**. The genuine gap was the brief's third booking type — **customer-selected pandit**:

| Piece | Status | Evidence |
|---|---|---|
| `booking.preferred_pandit_id` (nullable FK) + migration | ✅ | `backend/app/marketplace/models.py`, `alembic/versions/b8d0e1f2a3c4_booking_preferred_pandit.py` |
| `BookingCreate.preferred_pandit_id`; validated approved on create (409 otherwise) | ✅ | `backend/app/marketplace/schemas.py`, `routers/customer.py` |
| Dispatch offers the chosen pandit **first**, falls back to nearest-first | ✅ | `backend/app/marketplace/dispatch.py` `_rank_candidates`; `test_booking_preferred.py` |

Tests: chosen (farther) partner offered before a nearer one; unapproved selection rejected. Suite **76 passed / 6 skipped**; migration base→head OK.

**Noted (not done):** customer-app UI to pass `preferred_pandit_id` from the discovery screen (mobile wiring — small follow-up); a durable scheduler to auto-dispatch **scheduled** bookings at their time (Phase 8 infra — currently scheduled bookings are created and wait).

## Phases 5–10
⚪ Phase 5 (one-backend integration) is inherently satisfied — all clients already use the one backend as source of truth (audit §10). Realtime is HTTP-poll today; a push/WebSocket upgrade is a Phase 8 architectural decision. Phases **6** (SMS/payments/push) and **9** (store builds) are **external-credential blocked** — to be built to a testable sandbox seam with the blocker documented. Phase 7 (admin Media/SEO/RBAC-UI) and Phase 8 (analytics + load testing) remain. Sequencing per `PRODUCTION-ROADMAP.md`. Nothing blocked will be claimed production-ready.

---

## Remaining risks
- No load-test evidence yet (Phase 8) — scale to 10M unproven.
- Frontend/mobile have no automated functional test suites.
- Production enablement (migrations-on-deploy, backup secret, KYC storage) is ops work requiring access this agent does not have.

## Next
Phase 1: release-management backend (model + migration + admin APIs + public active-releases endpoint + tests), then the public `/download` page + admin release screen with an accurate "unavailable" state (no fake links).
