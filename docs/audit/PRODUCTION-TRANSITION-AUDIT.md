# Production Transition — Read-Only Audit

**Date:** 2026-11-27 · **Scope:** read-only (no code/infra changes, no deploys, no migrations).
**Method:** repo inspection + `gh pr list` + safe HTTP probes. Live Supabase/Vercel
dashboards were **not** accessible from here — anything needing them is marked **GATED**.

---

## A. Status by brief area

| # | Area | Status | Evidence / note |
|---|------|--------|-----------------|
| 1 | Audit current deployment | **Done (this doc)** | Prod probed 500; PR/branch map below. |
| 2 | Production DB integration | **Partial / Gated** | 9 Alembic migrations exist; **not auto-run on boot** (no `create_all`/`upgrade` in `app/main.py`). Live Supabase state unknown — GATED. |
| 3 | Remove dev/sample data | **Partial** | Mock OTP already prod-disabled (see §C). Seed scripts `backend/seed.py`, `seed_marketplace.py` exist. Live record cleanup = GATED (needs DB access + approval). |
| 4 | Production authentication | **Partial / Gated** | Real OTP path (MSG91) implemented in `app/marketplace/sms.py`; fails closed. **MSG91 keys not set** → prod OTP will 503 until configured. Mock refused in prod. |
| 5 | Customer app prod integration | **Partial** | App talks to `EXPO_PUBLIC_API_BASE`; prod profile points at `panditji-express2.vercel.app` (currently 500). Needs live backend up. |
| 6 | Partner app prod integration | **Partial** | Same as #5; KYC/verification flows exist (PR #6 merged). |
| 7 | CRM production integration | **In progress (open PRs)** | Enterprise CRM modules 01–08 are **open** PRs #18–#28 + roadmap #17; not merged/deployed. |
| 8 | Website & CMS | **Partial** | CMS sync fixed (PR #16 merged). Live site returns 307 (redirect); full publish lifecycle = needs live backend. |
| 9 | Razorpay payments | **Not started (backend)** | No `razorpay_*` settings in `app/core/config.py`; only `payment_webhook_secret`. GATED (keys + sandbox). |
| 10 | Production security / RLS | **Gated** | RLS, Supabase grants, bucket policies not verifiable without Supabase access. Code-level rate-limit/audit/hardening present (PRs #1, #11). |
| 11 | Env configuration | **Partial** | `.env.example` missing several prod vars (see §D). |
| 12 | Production mobile builds | **Not started** | Only `testing` + `production` EAS profiles exist; prod APK/AAB not built this cycle. Needs live prod backend first. |
| 13 | Release management | **Partial** | App-release docs exist (`docs/development/MOBILE-BUILD-STATUS.md`); release-mgmt system integration pending. |
| 14 | End-to-end verification | **Blocked** | Cannot run until prod backend is up (currently 500) + MSG91 configured. |
| 15 | Autonomous execution | **Ongoing** | This audit + mobile testing env (PR #19) done autonomously. |

---

## B. Branch & PR map

**Merged (in `main`):** #1 P0 hardening · #2 homepage · #3 admin change-password · #4 mobile phase 2–4 · #6 KYC flow · #7 KYC runbook · #10 download page · #13 "Panditji" copy · #14 premium mobile redesign · #15 mobile dark-mode/QA · #16 CMS sync.

**Open — backend/release:**
- **#29 `hotfix: prod backend down — add Pillow to Vercel requirements`** — traces the prod 500 to a missing `Pillow` dep crashing the serverless function on import. **Review + merge candidate (gated deploy).**
- **#11 Full backend release** (features + backend-P4) — large, still open.
- **#19 Free mobile testing environment** (this workstream) — mock OTP + staging testing APKs + theme toggle.

**Open — Enterprise CRM stack (not merged, not deployed):**
#17 audit/roadmap · #18 Customers · #20 Partners 360 · #21 Live Ops · #22 Audit-log + roles · #23 Finance reports · #24 Reviews & support · #25 System health · #26 Service Areas (⚠ carries a gated migration) · #27 8 modules consolidated · #28 CRM + backend release integrated.
> These overlap (several consolidate the same modules). **Decision needed:** which CRM PR(s) are the canonical merge path — likely #27/#28 supersede #18–#26. Recommend picking one consolidated PR and closing the duplicates to avoid conflicting merges.

---

## C. Mock / dev providers — already production-safe ✅

`backend/app/core/config.py → validate_runtime()` refuses production boot with the
mock OTP provider or default secrets:

```python
if self.otp_effective_mode != "sms":
    raise RuntimeError("OTP_MODE must be 'sms' in production — the mock OTP "
                       "provider cannot be enabled in production. ...")
```

- Mock OTP (`OTP_MODE=mock`, fixed `123456`) **cannot** run in production; the dev
  code is returned only in mock mode (`app/marketplace/routers/auth.py`).
- The mobile **⚠ TESTING ENVIRONMENT** banner renders only in non-production builds
  (`EnvBanner` + `lib/env.ts`); production builds show nothing.
- Production also **fails closed** on OTP if MSG91 is unconfigured (503), and refuses
  default `JWT_SECRET` / `PAYMENT_WEBHOOK_SECRET` / `REVALIDATE_SECRET`.
- No auth bypass found — login always goes through OTP issue+verify.

---

## D. Environment variables

`.env.example` currently documents: `APP_ENV, DEBUG, APP_NAME, OTP_MODE, OTP_TEST_CODE,
OTP_TEST_NUMBERS, MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_OTP_TEMPLATE_ID, DATABASE_URL,
JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS,
COOKIE_SECURE, COOKIE_SAMESITE, CORS_ORIGINS, RATE_LIMIT_*, FRONTEND_REVALIDATE_URL,
REVALIDATE_SECRET, SITE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD`.

**Referenced in `config.py` but NOT in `.env.example`** (add as placeholders):
`OTP_PEPPER, PAYMENT_WEBHOOK_SECRET, REDIS_URL, UPSTASH_REDIS_REST_URL,
UPSTASH_REDIS_REST_TOKEN, SENTRY_DSN, GEO_BACKEND, STORAGE_BACKEND, STORAGE_LOCAL_DIR,
SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_STORAGE_BUCKET, VERIFICATION_MAX_UPLOAD_BYTES`.

**Absent entirely (brief requires):** Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
webhook secret) — no backend settings/integration yet. Push notifications — no config found.

---

## E. Production is DOWN — root cause (GATED fix)

`https://panditji-express2.vercel.app/health` → **500** (every route). Two compounding causes:
1. **Import crash** — PR #29: missing `Pillow` in Vercel serverless requirements → function crashes on import (500 `FUNCTION_INVOCATION_FAILED`).
2. **Secrets lockdown** — `validate_runtime()` refuses to boot while `JWT_SECRET` /
   `PAYMENT_WEBHOOK_SECRET` / `REVALIDATE_SECRET` are placeholders.

**Fix (all GATED — your action):** merge #29 (Pillow), set the three secrets (+ `DATABASE_URL`,
`MSG91_*`) in Vercel, redeploy, confirm `/health` = 200.

---

## F. Gated checklist (needs your credentials or explicit approval)

- [ ] **Bring prod back up:** merge PR #29, set Vercel secrets (`JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `REVALIDATE_SECRET`, `DATABASE_URL`), redeploy.
- [ ] **MSG91** live keys (`MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_OTP_TEMPLATE_ID`) for real OTP.
- [ ] **Supabase prod** access — verify RLS, grants, private KYC bucket, connection pooling; set `SUPABASE_*`, `STORAGE_BACKEND=supabase`.
- [ ] **Production migrations** — review backups/recovery, then `alembic upgrade head` (⚠ PR #26 carries a gated migration).
- [ ] **Razorpay** — add backend integration + sandbox keys; verify before live.
- [ ] **CRM merge decision** — choose the canonical CRM PR (#27/#28?) and close duplicates.
- [ ] **Data cleanup** — identify + approve removal of any test records (never delete real business data).
- [ ] **Go-live approvals** — prod deploy, public APK/AAB release, enabling live payments.

---

## G. Safe / unblocked next steps (no approval needed)

- Add the missing env vars to `.env.example` as placeholders (§D).
- Add a Razorpay settings scaffold (config fields + `.env.example`), sandbox-gated, no keys.
- Keep CRM modules building behind their PRs; consolidate the stack.
- Prepare production EAS build config (identifiers, versioning, no testing banner) — build only after prod backend is verified up.

> See also the CRM audit (PR #17) for the CRM-specific gap analysis — not duplicated here.
