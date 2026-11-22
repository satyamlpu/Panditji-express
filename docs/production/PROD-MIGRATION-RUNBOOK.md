# Production Migration & Deploy Runbook — Full Backend Release

This release (`release/full` → PR to `main`) brings the complete backend + admin
feature set to production: app releases, partner interview lifecycle,
customer-selected booking, media library, discovery enrichment (ETA / experience
/ specialisation), operations analytics, scheduled-booking dispatch, SMS/payment
seams, RBAC/SEO/Media admin UI, and backend-P4 (partner earnings, push-token
registry, finance report).

**Who runs this:** someone with production Supabase access and the Vercel project
env. The AI agent cannot run these steps — it has no production DB credentials.

**Golden rule — order matters:** apply the DB migrations **before** merging/
deploying. Every migration in this release is **additive** (new tables, new
nullable columns, a widened CHECK constraint), so the currently-deployed code
keeps working against the new schema. The reverse order (deploy first) would make
the new backend 500 on endpoints that read tables/columns that don't exist yet.

---

## 0. Pre-flight

- [ ] Confirm you can reach prod Supabase with a direct/session-pooler connection
      string (NOT the `:6543` transaction-pooler — Alembic needs a session).
      Store it as `DATABASE_URL`, e.g.
      `postgresql+psycopg://postgres:<pwd>@<host>:5432/postgres`.
- [ ] Take a fresh DB backup (Supabase dashboard → Database → Backups, or run
      `backend/ops/backup_db.sh` with `DATABASE_URL` set).
- [ ] Note the current prod Alembic revision for rollback:
      `DATABASE_URL=... alembic current`

## 1. Apply migrations to prod Supabase

From `backend/` on the release commit (or any checkout of this branch):

```bash
cd backend
DATABASE_URL="postgresql+psycopg://…:5432/postgres" .venv/bin/alembic upgrade head
```

This applies only the pending revisions, in order, to a single head:

| Revision | What it adds |
|---|---|
| `f2b3c4d5e6a7` | `app_release` table (website /download + CRM releases) |
| `a7c8d9e0f1b2` | pandit interview / re-verification states (widens `ck_pandit_status`) |
| `b8d0e1f2a3c4` | `booking.preferred_pandit_id` (nullable FK) |
| `c4d1e2f3a5b6` | `media_asset` table (Media Library) |
| `d5e2f3a4b6c7` | `pandit.experience_years` + `pandit.specialisation` (nullable) |
| `d4f7a2b8c1e9` | push-token registry table |
| `4a2a7c68abb5`, `54a335ac54d9` | no-op **merge** revisions unifying the above into one head |

Already-applied revisions (e.g. KYC `e1a2b3c4d5f6`) are skipped automatically.

- [ ] Verify a single head and that prod is at it:
      `DATABASE_URL=... alembic heads` → one line
      `DATABASE_URL=... alembic current` → `54a335ac54d9 (head)`

## 2. Create storage buckets + set env (only what you're enabling now)

Required for the features you intend to turn on; everything is gated so unset =
feature stays dormant (no crash).

- [ ] **KYC uploads** (if enabling partner KYC in prod): create a **private**
      Supabase bucket `kyc-private`; set `STORAGE_BACKEND=supabase`,
      `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET=kyc-private`.
- [ ] **Media Library**: create a (public-ish, served via proxy) bucket
      `media-public`; set `SUPABASE_MEDIA_BUCKET=media-public`
      (same `STORAGE_BACKEND=supabase` + `SUPABASE_*`).
- [ ] **Scheduled-booking dispatch**: set `SCHEDULER_SECRET=<random>` and add a
      cron (Vercel Cron / GitHub Action) that POSTs
      `/api/v1/mp/admin/scheduler/dispatch-due` with header
      `X-Scheduler-Token: <SCHEDULER_SECRET>` every 1–2 min. Unset secret = 503
      (disabled), which is safe.
- [ ] **Backups**: set the `DATABASE_URL` GitHub Actions secret to enable nightly
      backups.
- [ ] Optional/when ready: `REDIS_URL` (shared rate limits), `SENTRY_DSN`,
      `SMS_PROVIDER=msg91` + `MSG91_*`, `PAYMENT_PROVIDER=razorpay` + `RAZORPAY_*`.

> Note: these are set in the **Vercel project env** (backend project
> `panditji-express2`) and/or GitHub secrets — not committed to the repo.

## 3. Merge + deploy

- [ ] Ensure the release PR is **green** (CI: Backend PostgreSQL, Frontend, Vercel
      previews) and has required approvals.
- [ ] Merge the release PR into `main` (squash). Vercel auto-deploys **both**
      projects from `main`: frontend (`panditjiexpress.com`) and backend
      (`panditji-express2`).
- [ ] Wait for both Vercel deployments to report "Ready".

## 4. Post-deploy verification

```bash
# backend alive + new public endpoint now present (was 404 before)
curl -s -o /dev/null -w "%{http_code}\n" https://panditji-express2.vercel.app/health            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://panditji-express2.vercel.app/api/v1/public/app-releases  # 200 (was 404)
# discovery still works (schema has new columns)
curl -s "https://panditji-express2.vercel.app/api/v1/mp/discovery/services" -o /dev/null -w "%{http_code}\n"  # 200
```

- [ ] Admin: log in, open **App Releases**, **Media**, **Analytics**, **Staff &
      Roles**, **SEO** — all load.
- [ ] Public: `panditjiexpress.com/download` still renders (shows **Coming soon**
      until you add real release rows — see below).
- [ ] Mobile apps / partner app: smoke-test onboarding, discovery, booking — no
      500s (confirms schema matches code).

## 5. (Optional) Make /download show real links

The page intentionally shows **Coming soon** while there are no real builds — it
never renders fake links. To show actual download buttons you need **real app
builds** (Google Play / App Store listing, a signed APK URL, or a TestFlight
invite — these require Apple Developer + Google Play accounts + EAS builds).
Once a build exists, add it in **Admin → App Releases** with its real
`download_url` and set it active; the /download page then shows the button + QR.

---

## Rollback

- **App/deploy:** in Vercel, promote the previous production deployment (both
  projects) — instant.
- **DB:** the migrations are additive and safe to leave in place even if the app
  is rolled back (old code ignores the new tables/columns). Only if you must
  reverse them: `DATABASE_URL=... alembic downgrade <prev-revision>` (noted in
  step 0) — do this **after** rolling the app back, and expect to lose any data
  written to the new tables.

## What this release does NOT include (still external-blocked)

Live SMS delivery (MSG91 + DLT template), live payments (Razorpay live keys),
push **delivery** (FCM/APNs credentials — the token *registry* ships here),
mobile store builds (Apple/Google accounts), and a load-test run (isolated env).
Each is a config/credential step, not code.
