"""Phase 2: live tracking, ETA, location scope and notifications."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import LAT, LNG, _auth, _book, _make_pandit, _token


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _confirmed(client: AsyncClient, service_id) -> tuple[dict, str]:
    """Create + confirm a booking; return (booking, pandit_token)."""
    await _make_pandit("+910000001001", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    ptok = await _token(client, "+910000001001", "pandit")
    await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept",
        headers=_auth(ptok),
    )
    return booking, ptok


async def test_location_requires_active_booking(client: AsyncClient, service_id):
    await _make_pandit("+910000001002", LAT, LNG, service_id)
    ptok = await _token(client, "+910000001002", "pandit")
    # No booking assigned → cannot share location.
    res = await client.post(
        "/api/v1/mp/partner/location", headers=_auth(ptok),
        json={"lat": LAT, "lng": LNG},
    )
    assert res.status_code == 409


async def test_tracking_requires_assigned_active(client: AsyncClient, service_id):
    # Booking that found no partner (out of range) is not trackable.
    await _make_pandit("+910000001003", 20.0, 78.0, service_id)  # far
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    res = await client.get(
        f"/api/v1/mp/customer/bookings/{booking['id']}/tracking", headers=_auth(ctok)
    )
    assert res.status_code == 409


async def test_tracking_eta_and_freshness(client: AsyncClient, service_id):
    booking, ptok = await _confirmed(client, service_id)
    ctok = await _token(client, "+919999900000", "customer")

    # Before any location ping: trackable but no location yet.
    t0 = await client.get(
        f"/api/v1/mp/customer/bookings/{booking['id']}/tracking", headers=_auth(ctok)
    )
    assert t0.status_code == 200
    assert t0.json()["has_location"] is False

    # Partner goes en route and shares a nearby location.
    await client.post(
        f"/api/v1/mp/partner/bookings/{booking['id']}/status",
        headers=_auth(ptok), json={"to_status": "en_route"},
    )
    ping = await client.post(
        "/api/v1/mp/partner/location", headers=_auth(ptok),
        json={"lat": LAT + 0.02, "lng": LNG + 0.02, "accuracy_m": 15},
    )
    assert ping.status_code == 200
    assert ping.json()["eta_minutes"] >= 2

    t1 = (
        await client.get(
            f"/api/v1/mp/customer/bookings/{booking['id']}/tracking",
            headers=_auth(ctok),
        )
    ).json()
    assert t1["has_location"] is True
    assert t1["is_stale"] is False
    assert t1["eta_minutes"] is not None
    assert t1["pandit_name"]


async def test_notifications_emitted(client: AsyncClient, service_id):
    _booking, ptok = await _confirmed(client, service_id)
    ctok = await _token(client, "+919999900000", "customer")

    cust = (
        await client.get("/api/v1/mp/customer/notifications", headers=_auth(ctok))
    ).json()
    assert any(n["kind"] == "confirmed" for n in cust)

    part = (
        await client.get("/api/v1/mp/partner/notifications", headers=_auth(ptok))
    ).json()
    assert any(n["kind"] == "offer" for n in part)

    # mark-all-read works
    await client.post("/api/v1/mp/customer/notifications/read-all", headers=_auth(ctok))
    cust2 = (
        await client.get("/api/v1/mp/customer/notifications", headers=_auth(ctok))
    ).json()
    assert all(n["read"] for n in cust2)


async def test_completion_stops_tracking(client: AsyncClient, service_id):
    booking, ptok = await _confirmed(client, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    for to in ("en_route", "arrived", "in_progress", "completed"):
        await client.post(
            f"/api/v1/mp/partner/bookings/{booking['id']}/status",
            headers=_auth(ptok), json={"to_status": to},
        )
    # No longer trackable once completed.
    res = await client.get(
        f"/api/v1/mp/customer/bookings/{booking['id']}/tracking", headers=_auth(ctok)
    )
    assert res.status_code == 409
