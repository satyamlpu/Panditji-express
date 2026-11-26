# Database Security Audit & Hardening — Supabase Data API exposure

_Audited 2026-11-24 (prod project `easvvosvjaiaqcjuggki`, PostgreSQL 17.11)._

## Finding (HIGH)
The marketplace tables in the `public` schema were reachable through Supabase's
auto-generated **Data API (PostgREST)** by the `anon` and `authenticated` roles,
with **RLS disabled**:

| table | RLS | anon SELECT | authenticated SELECT |
|---|---|---|---|
| mp_booking | off | ✓ | ✓ |
| mp_pandit | off | ✓ | ✓ |
| mp_verification_document | off | ✓ | ✓ |
| service | off | ✓ | ✓ |

**Impact:** anyone holding the project's public `anon` key could read (and,
depending on grants, write) customer bookings & PII, pandit profiles, **KYC
verification records**, and other marketplace data — bypassing the application
entirely.

**Root cause:** Supabase grants the Data API roles access to the `public` schema
by default, and no RLS was set. This is a Supabase default-configuration gap, not
an application bug.

## Dependency audit — nothing uses the Data API ✅
Verified across the whole product:
- **No `@supabase/*` package** in the website, Customer app, or Partner app.
- **No** `createClient`, anon/service key, or `/rest/v1/` call in any client.
- Every client (website BFF, both Expo apps, admin CRM) talks **only to the
  FastAPI backend**. The backend reaches Postgres directly as the `postgres` role
  (SQLAlchemy) and Supabase **Storage** via the **server-only service key**.

→ The Data API is entirely unused, so disabling it for `anon`/`authenticated`
breaks nothing.

## Secure architecture (enforced)
```
Website / Customer app / Partner app / Admin CRM
                     │  (HTTPS, app JWT)
                     ▼
            FastAPI backend  ──(postgres role, SQLAlchemy)──▶  Postgres
                     └────────(service key)────────────────▶  Supabase Storage (private)
Supabase Data API (PostgREST, anon/authenticated)  ──✗ no access to public schema
```
FastAPI is the single authorized gateway; per-endpoint auth (`require_*`) + the
append-only audit log remain the access-control layer every client uses.

## Remediation — migration `e7a1b2c3d4f5` (version-controlled, Postgres-only)
1. **REVOKE** all table/sequence/routine privileges **and `USAGE ON SCHEMA public`**
   from `anon` and `authenticated` (guarded by role existence → no-op on CI/SQLite).
2. **ALTER DEFAULT PRIVILEGES** in `public` to REVOKE from those roles, so **future
   tables never inherit** the unsafe grants.
3. **Enable RLS** on every application table (defense-in-depth): the `postgres`
   owner the backend uses bypasses RLS; non-owner roles are denied even if a grant
   slips through. (`spatial_ref_sys` and `alembic_version` excluded.)
- Applied as part of the production migration (`c3e6a9f1d4b7 → e7a1b2c3d4f5`), in
  the same atomic transaction as the feature schema.
- **Downgrade** disables RLS but **deliberately does not re-grant** the anon access
  (never re-opens the hole).

## KYC / private storage review ✅
KYC documents are **not** affected by the Data API (they live in Storage, not a
table): a **private** Supabase bucket, written/read only with the server-side
**service key**, and downloaded by streaming bytes **through an authenticated,
audited backend endpoint** — no public or signed URL is ever handed to a client
(`backend/app/marketplace/storage.py`, `routers/admin.py`). The verification
table row now also sits behind the lockdown + RLS.

## Tests (`backend/tests/test_security.py`)
- Sensitive endpoints (customer/partner/admin/finance/KYC/media) reject anonymous
  requests with **401**.
- A bogus/cross-role bearer token is rejected.
- Public catalogue endpoints expose **no** phone/KYC/payout/token fields.
- The lockdown migration is present and correctly Postgres- + role-guarded.
> DB-role-level anon tests require the Supabase `anon`/`authenticated` roles, which
> exist only on the Supabase instance; verify there with the queries below.

## Post-migration verification (run in Supabase SQL Editor, after applying)
```sql
-- anon/authenticated should have NO access to the public schema:
select has_schema_privilege('anon','public','USAGE')            as anon_usage,        -- expect false
       has_table_privilege('anon','mp_booking','SELECT')        as anon_booking_sel,  -- expect false
       has_table_privilege('authenticated','mp_verification_document','SELECT') as auth_kyc_sel; -- false
-- RLS enabled on sensitive tables:
select relname, relrowsecurity from pg_class
 where relnamespace='public'::regnamespace
   and relname in ('mp_booking','mp_pandit','mp_verification_document','service',
                   'app_release','media_asset','mp_push_token');   -- all true
```

## Verdict
With `e7a1b2c3d4f5` applied, the Data API exposure is closed and future tables are
safe by default, with **zero** impact on the application (nothing used the Data
API). **GO** — apply the hardening as part of the production migration.
