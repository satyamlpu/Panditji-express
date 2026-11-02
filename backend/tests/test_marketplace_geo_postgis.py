"""PostGIS geo backend — indexed radius matching (PostgreSQL only).

Runs only when the suite is pointed at PostgreSQL *and* the PostGIS extension
can be created. The normal suite keeps the haversine backend on both engines;
this verifies that, with GEO_BACKEND=postgis and the spatial schema applied,
dispatch's radius filter (ST_DWithin over the GiST-indexed geography column, kept
in sync by the trigger) selects the same partners the haversine path would.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import select, text

from app.core.config import settings
from app.marketplace.constants import BookingStatus
from app.marketplace.geo import POSTGIS_GEO_DDL
from app.models.service import Service
from tests.conftest import IS_SQLITE, TestSession, engine
from tests.test_marketplace import _auth, _book, _make_pandit, _token

pytestmark = pytest.mark.skipif(
    IS_SQLITE, reason="PostGIS geo backend requires PostgreSQL"
)


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _install_postgis() -> bool:
    """Apply the spatial schema (same DDL the migration runs). False if the
    PostGIS extension isn't available on this server."""
    try:
        async with engine.begin() as conn:
            for stmt in POSTGIS_GEO_DDL:
                await conn.exec_driver_sql(stmt)
        return True
    except Exception:
        return False


async def test_postgis_radius_matching(client, service_id, monkeypatch):
    if not await _install_postgis():
        pytest.skip("PostGIS extension not available on this PostgreSQL server")
    monkeypatch.setattr(settings, "geo_backend", "postgis")

    # Near partner (~0.1 km) is in range; far partner (~25 km) is outside the
    # 15 km radius and must be filtered out by the indexed ST_DWithin.
    await _make_pandit("+910000004001", 26.451, 80.331, service_id)
    await _make_pandit("+910000004002", 26.60, 80.50, service_id)

    # The trigger populated base_geog from base_lat/base_lng on insert.
    async with TestSession() as s:
        non_null = (
            await s.execute(
                text("SELECT count(*) FROM mp_pandit WHERE base_geog IS NOT NULL")
            )
        ).scalar_one()
    assert non_null == 2

    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    assert booking["status"] == BookingStatus.AWAITING_ACCEPTANCE

    # Only the near partner is eligible → exactly one offer, to them.
    near = await _token(client, "+910000004001", "pandit")
    offers = (
        await client.get("/api/v1/mp/partner/booking-requests", headers=_auth(near))
    ).json()
    assert len(offers) == 1 and offers[0]["code"] == booking["code"]

    far = await _token(client, "+910000004002", "pandit")
    far_offers = (
        await client.get("/api/v1/mp/partner/booking-requests", headers=_auth(far))
    ).json()
    assert far_offers == []


async def test_postgis_uses_gist_index(client, service_id, monkeypatch):
    """The radius filter must hit the GiST index, not a seq scan — the whole
    point of the PostGIS backend at city scale."""
    if not await _install_postgis():
        pytest.skip("PostGIS extension not available on this PostgreSQL server")

    async with engine.begin() as conn:
        # Force the planner to reveal that the GiST index is usable for the
        # radius predicate (on a small/empty table a seq scan is cheaper, which
        # would hide index usability rather than disprove it).
        await conn.exec_driver_sql("SET LOCAL enable_seqscan = off")
        plan_rows = (
            await conn.exec_driver_sql(
                "EXPLAIN SELECT id FROM mp_pandit WHERE ST_DWithin("
                "base_geog, ST_SetSRID(ST_MakePoint(80.33, 26.45), 4326)::geography, "
                "15000)"
            )
        ).fetchall()
    plan = "\n".join(r[0] for r in plan_rows)
    assert "ix_pandit_base_geog" in plan, plan
