# Consolidated Release — Production Deployment Runbook

Covers shipping the consolidated PR (#11 backend release + CRM Modules 01–08) to
production. **Target Alembic head: `de1035e6959b`.** Production is currently at
`c3e6a9f1d4b7`.

> ⛔ **Approval-gated.** Nothing here was run against production by the agent. Every
> step below is for a human with prod credentials to execute. Do the backup first.

Stack: **Render-or-Vercel FastAPI backend** (`panditji-express2.vercel.app` is the
active API) · **Supabase Postgres** · **Vercel frontend**
(`frontend-umber-six-66.vercel.app`) · **two Expo apps**.

---

## 0. Pre-flight — required production config (set BEFORE/with deploy)

The consolidated code needs these env vars in the backend host (Render/Vercel).
Missing ones cause silent fallback to dev behaviour.

| Var | Why | Risk if unset |
|-----|-----|---------------|
| `APP_ENV=production` | Disables `/docs`, the dev `/mock/pay` endpoint, etc. | `/mock/pay` would let anyone mark bookings paid |
| `DATABASE_URL` | Supabase **owner (`postgres`) role**, **direct/session** (5432) | ⚠️ After #11's RLS migration, a *restricted* role is denied — backend 500s on every query |
| `JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET` | strong, non-default | token forgery / webhook spoofing |
| `PAYMENT_PROVIDER=razorpay` + Razorpay keys | real payments | defaults to the **mock** gateway → no real charges |
| `SMS_PROVIDER=msg91` + MSG91 creds | real OTP delivery | OTP only logged, users can't receive codes |
| `MEDIA_STORAGE_BACKEND=supabase`, `SUPABASE_MEDIA_BUCKET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `MEDIA_PUBLIC_BASE_URL` | public image uploads | new media uploads fail / 500 |
| `CORS_ORIGINS`, `FRONTEND_REVALIDATE_URL`, `REVALIDATE_SECRET`, `SITE_URL` | CMS sync + CORS | CMS edits lag; cross-origin blocked |

**RLS note (critical):** migration `e7a1b2c3d4f5` revokes the Supabase Data-API from
`anon`/`authenticated` and enables RLS. The backend must connect as the **table
owner** (`postgres`), which *bypasses* RLS. Confirm `DATABASE_URL`'s role before
migrating, or the app loses all DB access.

---

## 1. Backup (do this first, every time)

```bash
# Full logical backup of the prod DB (Supabase → direct connection string).
pg_dump "$PROD_DATABASE_URL" -Fc -f panditji_prod_$(date +%Y%m%d_%H%M).dump
# Verify it restores into a throwaway DB before proceeding.
createdb pj_restore_check && pg_restore -d pj_restore_check panditji_prod_*.dump && dropdb pj_restore_check
```
Also take a **Supabase dashboard point-in-time snapshot** if on a plan that supports
it. Record the current head: `SELECT version_num FROM alembic_version;` → expect
`c3e6a9f1d4b7`.

---

## 2. Migration plan (c3e6a9f1d4b7 → de1035e6959b)

Two equivalent ways — **pick one**, run on a **direct/session connection (5432)**,
not the 6543 transaction pooler:

**A. Alembic (recommended):**
```bash
cd backend && DATABASE_URL="$PROD_DATABASE_URL" alembic upgrade head
# applies: e1a2b3c4d5f6 (KYC doc files), #16 d4f7b1a9c2e8 (CMS media), #11 chain
# (app_release, interview states, booking-preferred, push-tokens, experience/
# specialisation), e7a1b2c3d4f5 (Data-API+RLS lockdown), f1a2b3c4d5e6 (Service
# Areas), de1035e6959b (merge). PostGIS was c3e6a9f1d4b7 — already applied.
```

**B. Reviewed SQL (for the Supabase SQL Editor):**
Run [`PROD-MIGRATE-c3e6a9f1d4b7-to-de1035e6959b.sql`](./PROD-MIGRATE-c3e6a9f1d4b7-to-de1035e6959b.sql).
It is one atomic transaction with a **self-abort guard** (RAISES and rolls back if
`alembic_version <> c3e6a9f1d4b7`), so a wrong/duplicate run changes nothing.

Verify after: `SELECT version_num FROM alembic_version;` → `de1035e6959b`.

---

## 3. Deployment sequence

1. **Backup** (§1) + confirm restore.
2. **Set/confirm prod env** (§0) — especially the owner-role `DATABASE_URL`.
3. **Merge the consolidated PR** → the backend host redeploys the new code.
   - The new code expects the new schema. If the host auto-deploys on merge and the
     migration isn't run yet, service endpoints 500 until §4. Keep the window short:
     run the migration immediately after (or during a brief maintenance window).
4. **Run the migration** (§2) against prod.
5. **Frontend**: Vercel redeploys the frontend on merge; no DB dependency.
6. **Smoke test** (§5). If green, announce done.

> The already-merged **Pillow hotfix (#29)** stays in; it is what keeps the Vercel
> serverless function booting. Do not revert it.

---

## 4. Rollback strategy

Trigger rollback if §5 smoke tests fail and can't be fixed forward in minutes.

1. **Code**: redeploy the previous backend build (Vercel/Render "promote previous
   deployment"); revert the frontend likewise.
2. **Database** (only if the migration must be undone):
   ```bash
   cd backend && DATABASE_URL="$PROD_DATABASE_URL" alembic downgrade c3e6a9f1d4b7
   ```
   This drops the new tables (`mp_service_area`, `media_asset`, `content_revision`,
   app_release, push_tokens) and new columns, and re-grants the Data-API that
   `e7a1b2c3d4f5` revoked. Verified up+down on SQLite; the RLS revoke/re-grant is
   role-guarded (no-op where roles are absent).
3. **Worst case**: restore the §1 `pg_dump` into a fresh DB and repoint
   `DATABASE_URL`.
Always re-run §5 after a rollback.

---

## 5. Post-deployment verification checklist

Backend (API host):
- [ ] `GET /health` → `200 {"status":"ok","env":"production"}`
- [ ] `GET /health/db` → `{"db":"connected"}`
- [ ] `SELECT version_num FROM alembic_version` → `de1035e6959b`
- [ ] `GET /api/v1/public/services` → `200` (catalog loads — was the 500)
- [ ] `GET /api/v1/mp/discovery/services` → `200`
Admin CRM (`frontend-umber-six-66.vercel.app/admin`):
- [ ] Admin login succeeds; dashboard loads with real counts
- [ ] Customers, Partners, Live Ops, Finance (+Reports), Reviews, Support, Audit &
      Roles, System Health, Service Areas, Analytics, Staff, App Releases all load
- [ ] System Health shows `dialect: postgresql`, DB connected, no warnings
- [ ] A finance-role staffer is denied on Customers/Audit (RBAC enforced)
Money/notify path (use a test customer/partner, small amount):
- [ ] OTP delivered (real SMS), customer + partner can log in
- [ ] Booking → dispatch → accept → status → **real Razorpay payment** → webhook
      verified → ledger posted → notification received
- [ ] Refund (finance) processes; ledger + reconciliation reflect it
Apps / website:
- [ ] Customer app: discovery, booking, tracking, pay, notifications
- [ ] Pandit app: onboarding/KYC upload, availability, offer accept, earnings
- [ ] Website: service listings + thumbnails render; a CMS edit publishes to live

---

## 6. Known caveats carried into this release
- Serviceability **enforcement** against `mp_service_area` is not wired into dispatch
  (a pending product decision); the areas are a managed catalogue only.
- Business decisions still open (not hardcoded): commission %, payout cycle,
  cancellation charges, KYC document policy, tax/GST.
- Prod-like **staging** migration dry-run (PostGIS) could not be executed in the
  agent's local env (no PostGIS); CI runs the PostGIS suite, and the migration was
  verified up+down on SQLite + the full schema on PostgreSQL via `create_all`.
