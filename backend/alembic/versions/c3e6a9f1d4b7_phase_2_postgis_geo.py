"""phase 2 postgis geo

Adds the PostGIS spatial backend for dispatch radius matching (Audit Phase-0,
Roadmap Phase 2 — geo slice; RK-14): a ``geography(Point,4326)`` column on
``mp_pandit`` kept in sync with the plain lat/lng floats by a trigger, plus a
GiST index for indexed ``ST_DWithin`` radius filtering.

PostgreSQL only — the DDL (shared with the integration test) lives in
``app.marketplace.geo``. On SQLite this is a no-op; dev/test keep the haversine
backend. Activate in production by setting ``GEO_BACKEND=postgis`` after this
migration runs; the plain base_lat/base_lng columns are retained, so the change
is reversible by flipping the flag back.

Revision ID: c3e6a9f1d4b7
Revises: b2d5f8a3c1e4
Create Date: 2026-11-02 11:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.marketplace.geo import POSTGIS_GEO_DDL, POSTGIS_GEO_DROP

revision: str = "c3e6a9f1d4b7"
down_revision: str | None = "b2d5f8a3c1e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for stmt in POSTGIS_GEO_DDL:
        op.execute(stmt)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for stmt in POSTGIS_GEO_DROP:
        op.execute(stmt)
