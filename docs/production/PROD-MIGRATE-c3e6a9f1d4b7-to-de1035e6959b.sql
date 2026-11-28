-- ============================================================================
-- Pandit Ji Express — PRODUCTION migration for the consolidated release (PR #28)
-- Brings prod from its CURRENT head  c3e6a9f1d4b7  up to the single new head
--   de1035e6959b  (covers: e1a2b3c4d5f6 KYC doc files, #16 d4f7b1a9c2e8 CMS media,
--   #11 app_release / interview-states / booking-preferred / push-tokens /
--   experience-specialisation / Data-API+RLS lockdown e7a1b2c3d4f5,
--   f1a2b3c4d5e6 Service Areas, and the merge de1035e6959b).
--
-- SAFE TO RUN ONCE, from c3e6a9f1d4b7 ONLY. Fully transactional (BEGIN/COMMIT):
--   the self-abort guard below RAISES (rolling everything back) if prod is not
--   at c3e6a9f1d4b7, so a wrong/duplicate run changes nothing.
-- Run on a DIRECT/session connection (port 5432), NOT the 6543 transaction pooler.
-- No PostGIS / CREATE EXTENSION here (that was c3e6a9f1d4b7, already on prod).
-- Equivalent to:  cd backend && DATABASE_URL=<prod> alembic upgrade head
-- ============================================================================

BEGIN;

-- Self-abort guard: only proceed if prod is exactly at c3e6a9f1d4b7.
DO $$
DECLARE cur text;
BEGIN
  SELECT version_num INTO cur FROM alembic_version;
  IF cur IS DISTINCT FROM 'c3e6a9f1d4b7' THEN
    RAISE EXCEPTION 'ABORT: alembic_version is %, expected c3e6a9f1d4b7. No changes applied.', cur;
  END IF;
END $$;

-- Running upgrade c3e6a9f1d4b7 -> e1a2b3c4d5f6

ALTER TABLE mp_verification_document ADD COLUMN note TEXT;

ALTER TABLE mp_verification_document ADD COLUMN content_type VARCHAR;

ALTER TABLE mp_verification_document ADD COLUMN size_bytes INTEGER;

UPDATE alembic_version SET version_num='e1a2b3c4d5f6' WHERE alembic_version.version_num = 'c3e6a9f1d4b7';

-- Running upgrade e1a2b3c4d5f6 -> f2b3c4d5e6a7

CREATE TABLE app_release (
    id UUID NOT NULL, 
    app_type VARCHAR NOT NULL, 
    platform VARCHAR NOT NULL, 
    channel VARCHAR DEFAULT 'beta' NOT NULL, 
    version VARCHAR NOT NULL, 
    build_number INTEGER, 
    download_url VARCHAR, 
    checksum_sha256 VARCHAR, 
    release_notes TEXT, 
    min_supported_version VARCHAR, 
    is_active BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_app_release_app_type ON app_release (app_type);

UPDATE alembic_version SET version_num='f2b3c4d5e6a7' WHERE alembic_version.version_num = 'e1a2b3c4d5f6';

-- Running upgrade f2b3c4d5e6a7 -> a7c8d9e0f1b2

ALTER TABLE mp_pandit DROP CONSTRAINT ck_pandit_status;

ALTER TABLE mp_pandit ADD CONSTRAINT ck_pandit_status CHECK (status IN ('draft', 'submitted', 'under_review', 'action_required', 'interview_scheduled', 'interview_completed', 'approved', 'rejected', 'suspended', 'reverification_required'));

UPDATE alembic_version SET version_num='a7c8d9e0f1b2' WHERE alembic_version.version_num = 'f2b3c4d5e6a7';

-- Running upgrade a7c8d9e0f1b2 -> b8d0e1f2a3c4

ALTER TABLE mp_booking ADD COLUMN preferred_pandit_id UUID;

ALTER TABLE mp_booking ADD CONSTRAINT fk_booking_preferred_pandit FOREIGN KEY(preferred_pandit_id) REFERENCES mp_pandit (id) ON DELETE SET NULL;

UPDATE alembic_version SET version_num='b8d0e1f2a3c4' WHERE alembic_version.version_num = 'a7c8d9e0f1b2';

-- Running upgrade b8d0e1f2a3c4 -> c4d1e2f3a5b6

UPDATE alembic_version SET version_num='c4d1e2f3a5b6' WHERE alembic_version.version_num = 'b8d0e1f2a3c4';

-- Running upgrade c4d1e2f3a5b6 -> d5e2f3a4b6c7

ALTER TABLE mp_pandit ADD COLUMN experience_years INTEGER;

ALTER TABLE mp_pandit ADD COLUMN specialisation VARCHAR;

UPDATE alembic_version SET version_num='d5e2f3a4b6c7' WHERE alembic_version.version_num = 'c4d1e2f3a5b6';

-- Running upgrade e1a2b3c4d5f6 -> d4f7b1a9c2e8

CREATE TABLE media_asset (
    id UUID NOT NULL, 
    storage_backend VARCHAR DEFAULT 'local' NOT NULL, 
    storage_key VARCHAR NOT NULL, 
    original_key VARCHAR, 
    thumb_key VARCHAR, 
    url VARCHAR NOT NULL, 
    thumb_url VARCHAR, 
    filename VARCHAR NOT NULL, 
    content_type VARCHAR NOT NULL, 
    byte_size INTEGER DEFAULT '0' NOT NULL, 
    width INTEGER, 
    height INTEGER, 
    alt_text TEXT, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE content_revision (
    id UUID NOT NULL, 
    entity_type VARCHAR NOT NULL, 
    entity_id VARCHAR NOT NULL, 
    version INTEGER DEFAULT '1' NOT NULL, 
    action VARCHAR NOT NULL, 
    snapshot JSON, 
    actor_id UUID, 
    actor_email VARCHAR, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_content_revision_entity_type ON content_revision (entity_type);

CREATE INDEX ix_content_revision_entity_id ON content_revision (entity_id);

ALTER TABLE service ADD COLUMN title_hi VARCHAR;

ALTER TABLE service ADD COLUMN thumbnail_media_id UUID;

ALTER TABLE service ADD COLUMN thumbnail_url VARCHAR;

ALTER TABLE service ADD COLUMN thumbnail_alt VARCHAR;

CREATE INDEX ix_service_thumbnail_media_id ON service (thumbnail_media_id);

ALTER TABLE category ADD COLUMN thumbnail_media_id UUID;

ALTER TABLE category ADD COLUMN thumbnail_url VARCHAR;

ALTER TABLE category ADD COLUMN thumbnail_alt VARCHAR;

CREATE INDEX ix_category_thumbnail_media_id ON category (thumbnail_media_id);

ALTER TABLE service ADD CONSTRAINT fk_service_thumbnail_media FOREIGN KEY(thumbnail_media_id) REFERENCES media_asset (id) ON DELETE SET NULL;

ALTER TABLE category ADD CONSTRAINT fk_category_thumbnail_media FOREIGN KEY(thumbnail_media_id) REFERENCES media_asset (id) ON DELETE SET NULL;

INSERT INTO alembic_version (version_num) VALUES ('d4f7b1a9c2e8') RETURNING alembic_version.version_num;

-- Running upgrade d4f7b1a9c2e8 -> f1a2b3c4d5e6

CREATE TABLE mp_service_area (
    name VARCHAR NOT NULL, 
    city VARCHAR, 
    center_lat FLOAT NOT NULL, 
    center_lng FLOAT NOT NULL, 
    radius_km FLOAT NOT NULL, 
    pincodes JSON, 
    active BOOLEAN NOT NULL, 
    notes TEXT, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT ck_service_area_radius_pos CHECK (radius_km > 0)
);

CREATE INDEX ix_mp_service_area_active ON mp_service_area (active);

UPDATE alembic_version SET version_num='f1a2b3c4d5e6' WHERE alembic_version.version_num = 'd4f7b1a9c2e8';

-- Running upgrade c3e6a9f1d4b7 -> d4f7a2b8c1e9

CREATE TABLE mp_push_token (
    token VARCHAR NOT NULL, 
    principal_kind VARCHAR NOT NULL, 
    principal_id UUID NOT NULL, 
    platform VARCHAR NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_mp_push_token_token ON mp_push_token (token);

CREATE INDEX ix_mp_push_token_principal_id ON mp_push_token (principal_id);

INSERT INTO alembic_version (version_num) VALUES ('d4f7a2b8c1e9') RETURNING alembic_version.version_num;

-- Running upgrade d4f7a2b8c1e9, e1a2b3c4d5f6 -> 4a2a7c68abb5

UPDATE alembic_version SET version_num='4a2a7c68abb5' WHERE alembic_version.version_num = 'd4f7a2b8c1e9';

-- Running upgrade 4a2a7c68abb5, d5e2f3a4b6c7 -> 54a335ac54d9

DELETE FROM alembic_version WHERE alembic_version.version_num = '4a2a7c68abb5';

UPDATE alembic_version SET version_num='54a335ac54d9' WHERE alembic_version.version_num = 'd5e2f3a4b6c7';

-- Running upgrade 54a335ac54d9, d4f7b1a9c2e8 -> e7a1b2c3d4f5

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
    WHERE schemaname = 'public' AND tablename NOT IN ('spatial_ref_sys', 'alembic_version')
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;;

UPDATE alembic_version SET version_num='e7a1b2c3d4f5' WHERE alembic_version.version_num = '54a335ac54d9';

-- Running upgrade e7a1b2c3d4f5, f1a2b3c4d5e6 -> de1035e6959b

DELETE FROM alembic_version WHERE alembic_version.version_num = 'e7a1b2c3d4f5';

UPDATE alembic_version SET version_num='de1035e6959b' WHERE alembic_version.version_num = 'f1a2b3c4d5e6';


COMMIT;
