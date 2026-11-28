-- Pandit Ji Express — apply the #16 CMS/media migration (d4f7b1a9c2e8) to PRODUCTION.
-- Run this in the Supabase SQL Editor (or psql) against the prod DB.
-- Safe ONLY if prod alembic_version is currently 'e1a2b3c4d5f6' (verify first:
--   SELECT version_num FROM alembic_version; ). Idempotent it is NOT — run once.
-- It is fully transactional (BEGIN/COMMIT): if anything fails, nothing is applied.

BEGIN;

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

UPDATE alembic_version SET version_num='d4f7b1a9c2e8' WHERE alembic_version.version_num = 'e1a2b3c4d5f6';

COMMIT;

