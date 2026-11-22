# Prod migration — KYC document file upload (`e1a2b3c4d5f6`)

Apply this once to the **production Supabase** database after the
`backend-verification` / `mobile-phase2` merges. Deploys on this repo do **not**
run migrations automatically (`backend/vercel.json` has no build command, and
`create_all` only covers dev SQLite), so prod currently runs the new code on the
old schema. Until this is applied, the verification endpoints will return 500 in
production.

**What the migration adds** to table `mp_verification_document`:
`note TEXT`, `content_type VARCHAR`, `size_bytes INTEGER` (all nullable,
additive — no backfill, no data loss). Revision `e1a2b3c4d5f6`, whose
`down_revision` is the previous head `c3e6a9f1d4b7`.

---

## 0. Prerequisites

- Supabase project access (SQL editor is enough for the quick path).
- For the Alembic path: the prod **DDL** connection string. Use the Supabase
  **Session pooler (port 5432)** or the **direct** connection for running
  migrations — *not* the Transaction pooler (6543) the app uses at runtime, which
  can choke on migration DDL. Get it from Supabase → Project → Connect.

---

## 1. Check current state first (SQL editor)

Run in the Supabase SQL editor and read the two results:

```sql
-- (a) which columns already exist?
select column_name
from information_schema.columns
where table_name = 'mp_verification_document'
order by column_name;

-- (b) what revision does Alembic think prod is at?
select version_num from alembic_version;
```

Decide the path from result (b):

- **`version_num = c3e6a9f1d4b7`** → prod is exactly one step behind. Use
  **Path A** (Alembic) — it applies only `e1a2b3c4d5f6` and records it.
- **anything else, no row, or no `alembic_version` table** → the version table is
  out of sync with the live schema; do **not** run `alembic upgrade head`
  (it would replay intervening migrations against tables that already exist and
  error). Use **Path B** (idempotent SQL), then stamp.

---

## 2A. Path A — Alembic (preferred, when version = `c3e6a9f1d4b7`)

From `backend/`, with the prod DDL URL. This applies the migration **and**
updates `alembic_version`:

```bash
DATABASE_URL="<prod-session-pooler-or-direct-url>" ./.venv/bin/alembic upgrade head
```

Expected tail: `Running upgrade c3e6a9f1d4b7 -> e1a2b3c4d5f6, verification document file metadata`.

## 2B. Path B — idempotent SQL (when version is behind/unknown)

Run in the Supabase SQL editor. `IF NOT EXISTS` makes it safe to re-run:

```sql
alter table mp_verification_document add column if not exists note text;
alter table mp_verification_document add column if not exists content_type varchar;
alter table mp_verification_document add column if not exists size_bytes integer;
```

Then tell Alembic prod is now at head **without** re-running migrations:

```bash
DATABASE_URL="<prod-session-pooler-or-direct-url>" ./.venv/bin/alembic stamp e1a2b3c4d5f6
```

(If `alembic stamp` errors because the version table is in a strange state, the
`ALTER`s above are still sufficient for the app to work; fix the version table
separately.)

---

## 3. Verify the schema

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'mp_verification_document'
  and column_name in ('note','content_type','size_bytes')
order by column_name;
```

Expect three rows: `content_type varchar`, `note text`, `size_bytes integer`.
`select version_num from alembic_version;` should now read `e1a2b3c4d5f6`.

---

## 4. Configure private storage (so file uploads persist)

Vercel's filesystem is read-only except `/tmp`, so the default `local` backend
cannot store uploads in prod. In the **backend** Vercel project → Settings →
Environment Variables (Production), set:

```
STORAGE_BACKEND=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role key — server-only, never the anon key>
SUPABASE_STORAGE_BUCKET=kyc-private
```

Then in Supabase → Storage, create a bucket named **`kyc-private`** and keep it
**Private** (public toggle OFF). The backend proxies bytes through the
authenticated admin endpoint, so no public or signed URL is ever exposed.

Redeploy the backend (or trigger a redeploy) so the new env is picked up.

> Without step 4, note-only submissions work once step 1–3 are done, but
> uploading a file returns a storage error (502).

---

## 5. Prod smoke test (after steps 1–4)

With a throwaway applicant pandit on prod, confirm the round-trip:

1. Partner: `POST /api/v1/mp/partner/verification/documents` (multipart:
   `doc_type` + a small image `file`) → `201`, `has_file: true`.
2. Partner: `GET /api/v1/mp/partner/verification` → status `under_review`.
3. Admin (verification role): `GET /api/v1/mp/admin/pandits/{pid}/documents`
   → the doc with `has_file: true`.
4. Admin: `GET /api/v1/mp/admin/pandits/{pid}/documents/{doc_id}/file`
   → `200`, the image bytes, headers `Cache-Control: private, no-store`.
5. Admin: approve → partner sees `approved`.

(The same walk passed locally and in the Backend-PostgreSQL CI job.)

---

## Rollback

The change is additive, so a rollback is rarely needed. If required:

```bash
DATABASE_URL="<prod-session-pooler-or-direct-url>" ./.venv/bin/alembic downgrade c3e6a9f1d4b7
```

This drops the three columns (any uploaded-file metadata in them is lost; the
stored objects in the bucket are unaffected).
