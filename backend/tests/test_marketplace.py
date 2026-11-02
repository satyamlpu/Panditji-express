"""Marketplace dispatch engine: the SRS critical scenarios (§16.2)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import Availability, BookingStatus, PanditStatus
from app.marketplace.models import (
    DispatchAttempt,
    Pandit,
    PanditCapability,
)
from app.models.service import Service
from tests.conftest import TestSession

# All seeded pandits + the booking sit around this point.
LAT, LNG = 26.45, 80.33


async def _make_pandit(
    phone: str, lat: float, lng: float, service_id, *,
    status=PanditStatus.APPROVED, availability=Availability.ONLINE, radius=15.0,
) -> str:
    async with TestSession() as s:
        p = Pandit(
            phone=phone, name=f"P-{phone[-3:]}", base_lat=lat, base_lng=lng,
            service_radius_km=radius, status=status, availability=availability,
            last_heartbeat=datetime.now(UTC) if availability == Availability.ONLINE else None,
        )
        s.add(p)
        await s.flush()
        s.add(PanditCapability(pandit_id=p.id, service_id=service_id))
        await s.commit()
        return str(p.id)


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _token(client: AsyncClient, phone: str, kind: str) -> str:
    code = (
        await client.post(
            "/api/v1/mp/auth/otp/request", json={"phone": phone, "kind": kind}
        )
    ).json()["dev_code"]
    res = await client.post(
        "/api/v1/mp/auth/otp/verify",
        json={"phone": phone, "kind": kind, "code": code},
    )
    return res.json()["access_token"]


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def _book(client: AsyncClient, ctok: str, lat=LAT, lng=LNG) -> dict:
    res = await client.post(
        "/api/v1/mp/customer/bookings",
        headers=_auth(ctok),
        json={
            "service_slug": "published-puja", "mode": "immediate",
            "address_line": "Test addr, Kanpur", "lat": lat, "lng": lng,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


# ── Core: dispatch → offer → accept → confirmed ──────────────────────────────
async def test_booking_offers_nearest_and_confirms(client: AsyncClient, service_id):
    await _make_pandit("+910000000001", 26.451, 80.331, service_id)  # ~0.1km
    await _make_pandit("+910000000002", 26.60, 80.50, service_id)  # ~25km (out of range)

    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    assert booking["status"] == BookingStatus.AWAITING_ACCEPTANCE

    ptok = await _token(client, "+910000000001", "pandit")
    offers = (await client.get("/api/v1/mp/partner/booking-requests", headers=_auth(ptok))).json()
    assert len(offers) == 1 and offers[0]["code"] == booking["code"]

    res = await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept", headers=_auth(ptok)
    )
    assert res.status_code == 200
    assert res.json()["status"] == BookingStatus.CONFIRMED


async def test_no_partner_when_out_of_range(client: AsyncClient, service_id):
    await _make_pandit("+910000000003", 20.0, 78.0, service_id)  # far away
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)  # Kanpur — no partner in range
    assert booking["status"] == BookingStatus.NO_PARTNER


async def test_offline_partner_not_offered(client: AsyncClient, service_id):
    await _make_pandit("+910000000004", LAT, LNG, service_id, availability=Availability.OFFLINE)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    assert booking["status"] == BookingStatus.NO_PARTNER


async def test_unapproved_partner_cannot_go_online(client: AsyncClient, service_id):
    await _make_pandit(
        "+910000000005", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000000005", "pandit")
    res = await client.patch(
        "/api/v1/mp/partner/availability", headers=_auth(ptok), json={"availability": "online"}
    )
    assert res.status_code == 409


async def test_expired_offer_advances_to_no_partner(client: AsyncClient, service_id):
    pid = await _make_pandit("+910000000006", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    assert booking["status"] == BookingStatus.AWAITING_ACCEPTANCE

    # Force the live offer to have expired.
    async with TestSession() as s:
        att = (
            await s.execute(
                select(DispatchAttempt).where(
                    DispatchAttempt.booking_id == uuid.UUID(booking["id"])
                )
            )
        ).scalar_one()
        att.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await s.commit()

    # Customer reads the booking → tick() expires the offer; no other partner.
    got = (
        await client.get(
            f"/api/v1/mp/customer/bookings/{booking['id']}", headers=_auth(ctok)
        )
    ).json()
    assert got["status"] == BookingStatus.NO_PARTNER
    # Accepting an expired/closed offer must fail.
    ptok = await _token(client, "+910000000006", "pandit")
    res = await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept", headers=_auth(ptok)
    )
    assert res.status_code == 409
    assert pid  # referenced


async def test_cancel_frees_partner(client: AsyncClient, service_id):
    pid = await _make_pandit("+910000000007", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    ptok = await _token(client, "+910000000007", "pandit")
    await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept", headers=_auth(ptok)
    )

    # Partner is now busy.
    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))).scalar_one()
        assert p.availability == Availability.BUSY

    res = await client.post(
        f"/api/v1/mp/customer/bookings/{booking['id']}/cancel",
        headers=_auth(ctok), json={"reason": "changed plans"},
    )
    assert res.json()["status"] == BookingStatus.CANCELLED_CUSTOMER

    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))).scalar_one()
        assert p.availability == Availability.ONLINE  # freed


async def test_full_lifecycle_to_completed(client: AsyncClient, service_id):
    pid = await _make_pandit("+910000000008", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    ptok = await _token(client, "+910000000008", "pandit")
    await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept", headers=_auth(ptok)
    )
    for to in ("en_route", "arrived", "in_progress", "completed"):
        res = await client.post(
            f"/api/v1/mp/partner/bookings/{booking['id']}/status",
            headers=_auth(ptok), json={"to_status": to},
        )
        assert res.status_code == 200, res.text
        assert res.json()["status"] == to

    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))).scalar_one()
        assert p.availability == Availability.ONLINE  # freed after completion


# ── Admin ────────────────────────────────────────────────────────────────────
async def test_admin_verification_approves(client: AsyncClient, admin_token, service_id):
    pid = await _make_pandit(
        "+910000000009", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    res = await client.post(
        f"/api/v1/mp/admin/pandits/{pid}/verification-decision",
        headers=_auth(admin_token),
        json={"decision": "approve", "reason": "docs ok"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == PanditStatus.APPROVED


async def test_admin_manual_reassign(client: AsyncClient, admin_token, service_id):
    p1 = await _make_pandit("+910000000010", LAT, LNG, service_id)
    p2 = await _make_pandit("+910000000011", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    # Whoever got the first offer accepts; then reassign to the other partner.
    ptok1 = await _token(client, "+910000000010", "pandit")
    accept = await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept",
        headers=_auth(ptok1),
    )
    body = accept.json()
    assigned = body["assigned_pandit"]["id"] if accept.status_code == 200 else None
    other = p2 if assigned == p1 else p1
    res = await client.post(
        f"/api/v1/mp/admin/bookings/{booking['id']}/reassign",
        headers=_auth(admin_token),
        json={"pandit_id": other, "reason": "partner unreachable"},
    )
    assert res.status_code == 200
    assert res.json()["assigned_pandit"]["id"] == other


async def test_admin_bookings_require_staff(client: AsyncClient):
    res = await client.get("/api/v1/mp/admin/bookings")
    assert res.status_code == 401
