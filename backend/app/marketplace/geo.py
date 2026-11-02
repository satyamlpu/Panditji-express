"""Geo helpers. Dev uses haversine over lat/lng; production uses PostGIS.

The only place geography matters for dispatch is "is this partner within range
of the booking, and how far". Swapping to PostGIS changes the candidate query,
not the ranking logic.
"""

from __future__ import annotations

import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two lat/lng points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# ── PostGIS (production geo backend) ─────────────────────────────────────────
# A single source of truth for the spatial schema, executed by the Alembic
# migration and by the PostGIS integration test. PostgreSQL-only; the SQLite
# dev/test path never runs these (it uses haversine above). `base_geog` mirrors
# the plain base_lat/base_lng floats via a trigger, so no application code needs
# to know about geography — only the dispatch radius filter does, and only when
# settings.geo_backend == "postgis".
POSTGIS_GEO_DDL: tuple[str, ...] = (
    "CREATE EXTENSION IF NOT EXISTS postgis",
    "ALTER TABLE mp_pandit ADD COLUMN IF NOT EXISTS base_geog geography(Point, 4326)",
    (
        "UPDATE mp_pandit SET base_geog = "
        "ST_SetSRID(ST_MakePoint(base_lng, base_lat), 4326)::geography "
        "WHERE base_lat IS NOT NULL AND base_lng IS NOT NULL AND base_geog IS NULL"
    ),
    (
        "CREATE OR REPLACE FUNCTION mp_pandit_sync_geog() RETURNS trigger AS $$\n"
        "BEGIN\n"
        "  IF NEW.base_lat IS NOT NULL AND NEW.base_lng IS NOT NULL THEN\n"
        "    NEW.base_geog := "
        "ST_SetSRID(ST_MakePoint(NEW.base_lng, NEW.base_lat), 4326)::geography;\n"
        "  ELSE\n"
        "    NEW.base_geog := NULL;\n"
        "  END IF;\n"
        "  RETURN NEW;\n"
        "END;\n"
        "$$ LANGUAGE plpgsql"
    ),
    "DROP TRIGGER IF EXISTS trg_pandit_sync_geog ON mp_pandit",
    (
        "CREATE TRIGGER trg_pandit_sync_geog "
        "BEFORE INSERT OR UPDATE OF base_lat, base_lng ON mp_pandit "
        "FOR EACH ROW EXECUTE FUNCTION mp_pandit_sync_geog()"
    ),
    "CREATE INDEX IF NOT EXISTS ix_pandit_base_geog ON mp_pandit USING gist (base_geog)",
)

# Reverse order; the postgis extension itself is left installed (shared/global).
POSTGIS_GEO_DROP: tuple[str, ...] = (
    "DROP INDEX IF EXISTS ix_pandit_base_geog",
    "DROP TRIGGER IF EXISTS trg_pandit_sync_geog ON mp_pandit",
    "DROP FUNCTION IF EXISTS mp_pandit_sync_geog()",
    "ALTER TABLE mp_pandit DROP COLUMN IF EXISTS base_geog",
)
