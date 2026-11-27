"""Live Operations Centre: overview queues, alerts, map, RBAC."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import Availability, BookingStatus, PanditStatus, StaffRole
from app.marketplace.models import Booking, Customer, Pandit
from app.models.admin_user import AdminUser
from app.models.service import Service
from tests.conftest import TestSession

LAT, LNG = 26.45, 80.33


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _make_staff(email: str, role: str) -> None:
    async with TestSession() as s:
        s.add(
            AdminUser(
                email=email, full_name="Staffer",
                password_hash=hash_password("Test!Pandit123"),
                role=role, status=AdminStatus.ACTIVE,
            )
        )
        await s.commit()


async def _staff_token(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Test!Pandit123"}
    )
    return res.json()["access_token"]


async def _seed_ops(service_id: str) -> None:
    async with TestSession() as s:
        # Online partner on an active booking, with a fresh live location.
        p_on = Pandit(
            phone="+919000000001", name="Live Pandit", base_lat=LAT, base_lng=LNG,
            status=PanditStatus.APPROVED, availability=Availability.BUSY,
            live_lat=LAT + 0.01, live_lng=LNG + 0.01, live_at=datetime.now(UTC),
        )
        # An idle online partner (base-location marker).
        p_idle = Pandit(
            phone="+919000000002", name="Idle Pandit", base_lat=LAT + 0.02, base_lng=LNG,
            status=PanditStatus.APPROVED, availability=Availability.ONLINE,
        )
        s.add_all([p_on, p_idle])
        cust = Customer(phone="+919999900000", name="Asha")
        s.add(cust)
        await s.flush()
        svc = uuid.UUID(service_id)
        # Active booking (en_route) — assigned to the live partner.
        s.add(Booking(
            code="PJ-ACT001", customer_id=cust.id, service_id=svc, mode="immediate",
            status=BookingStatus.EN_ROUTE, address_line="A", dest_lat=LAT, dest_lng=LNG,
            service_title_snapshot="Published Puja", price_paise=210000,
            assigned_pandit_id=p_on.id,
        ))
        # A stuck dispatching booking (created 10 min ago).
        s.add(Booking(
            code="PJ-DIS001", customer_id=cust.id, service_id=svc, mode="immediate",
            status=BookingStatus.AWAITING_ACCEPTANCE, address_line="B",
            dest_lat=LAT, dest_lng=LNG, service_title_snapshot="Published Puja",
            price_paise=210000, created_at=datetime.now(UTC) - timedelta(minutes=10),
        ))
        # An unassigned booking (dispatch gave up).
        s.add(Booking(
            code="PJ-NOP001", customer_id=cust.id, service_id=svc, mode="immediate",
            status=BookingStatus.NO_PARTNER, address_line="C", dest_lat=LAT, dest_lng=LNG,
            service_title_snapshot="Published Puja", price_paise=210000,
        ))
        await s.commit()


@pytest.mark.asyncio
async def test_overview_queues_and_counts(client: AsyncClient, admin_token, service_id):
    await _seed_ops(service_id)
    res = await client.get("/api/v1/mp/admin/ops/overview", headers=_auth(admin_token))
    assert res.status_code == 200, res.text
    d = res.json()
    assert d["partners"]["online"] == 1 and d["partners"]["busy"] == 1
    assert d["bookings"]["active"] == 1
    assert d["bookings"]["dispatching"] == 1
    assert d["bookings"]["unassigned"] == 1

    assert [a["code"] for a in d["active"]] == ["PJ-ACT001"]
    assert d["active"][0]["eta_minutes"] is not None  # computed from live GPS
    assert [a["code"] for a in d["dispatching"]] == ["PJ-DIS001"]
    assert d["dispatching"][0]["waiting_seconds"] >= 300
    assert [a["code"] for a in d["unassigned"]] == ["PJ-NOP001"]


@pytest.mark.asyncio
async def test_alerts_surface_stuck_and_no_partner(client: AsyncClient, admin_token, service_id):
    await _seed_ops(service_id)
    d = (
        await client.get("/api/v1/mp/admin/ops/overview", headers=_auth(admin_token))
    ).json()
    kinds = {a["kind"] for a in d["alerts"]}
    assert "stuck_dispatch" in kinds  # the 10-min-old dispatching booking
    assert "no_partner" in kinds


@pytest.mark.asyncio
async def test_map_uses_real_coordinates_only(client: AsyncClient, admin_token, service_id):
    await _seed_ops(service_id)
    m = (await client.get("/api/v1/mp/admin/ops/map", headers=_auth(admin_token))).json()
    by_name = {p["name"]: p for p in m["partners"]}
    # The busy partner on an active booking shows its LIVE ping.
    assert by_name["Live Pandit"]["is_live"] is True
    assert by_name["Live Pandit"]["lat"] == pytest.approx(LAT + 0.01)
    # The idle online partner falls back to its declared base (not live).
    assert by_name["Idle Pandit"]["is_live"] is False
    assert any(dst["code"] in ("PJ-ACT001", "PJ-DIS001") for dst in m["destinations"])
    assert m["center_lat"] is not None


@pytest.mark.asyncio
async def test_rbac_ops_only(client: AsyncClient, service_id):
    await _make_staff("fin@panditjiexpress.in", StaffRole.FINANCE)
    ftok = await _staff_token(client, "fin@panditjiexpress.in")
    assert (
        await client.get("/api/v1/mp/admin/ops/overview", headers=_auth(ftok))
    ).status_code == 403
