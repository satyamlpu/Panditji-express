"""security: lock down the Supabase Data API (revoke anon/authenticated) + RLS

Revision ID: e7a1b2c3d4f5
Revises: 54a335ac54d9, d4f7b1a9c2e8
Create Date: 2026-11-24 12:00:00.000000

Context
-------
The marketplace tables were readable/writable by the Supabase ``anon`` and
``authenticated`` roles via the auto-generated Data API (PostgREST). Nothing in
this product uses that API — every client (website, both mobile apps, admin CRM)
talks only to the FastAPI backend, which reaches Postgres directly as the
``postgres`` role and Storage via the server-only service key. So we remove Data
API access to the whole ``public`` schema from those roles, stop future tables
from inheriting those grants, and enable RLS as defense-in-depth (the ``postgres``
owner the backend uses bypasses RLS; non-owner roles are denied).

Postgres-only. The role REVOKEs are guarded by role existence so this is a no-op
on CI Postgres (no Supabase roles) and on SQLite (dev/test).
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "e7a1b2c3d4f5"
# Merge reconciliation (release/full x main): this lock-down now also depends on
# the CMS media migration d4f7b1a9c2e8 (PR #16) so that media_asset/content_revision
# exist before RLS is enabled on every public table. Unifies the two heads into one.
down_revision: str | tuple[str, ...] | None = ("54a335ac54d9", "d4f7b1a9c2e8")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables we never touch: PostGIS system table + Alembic's own tracking table.
_SKIP = "('spatial_ref_sys', 'alembic_version')"

_UPGRADE = f"""
DO $$
DECLARE r record;
BEGIN
  -- 1) Remove Data API (PostgREST) access from anon/authenticated, if present.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM authenticated';
  END IF;
  -- 2) Defense-in-depth: enable RLS on every application table (owner bypasses).
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN {_SKIP}
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
"""

# Downgrade only disables RLS — it deliberately does NOT re-grant the anon/
# authenticated access, because that would re-open the data-exposure hole.
_DOWNGRADE = f"""
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN {_SKIP}
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
"""


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(_UPGRADE)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(_DOWNGRADE)
