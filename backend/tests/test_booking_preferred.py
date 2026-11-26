"""Customer-selected pandit booking: the chosen partner is offered first, with
fallback to normal nearest-first dispatch."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import Availability, PanditStatus
from app.marketplace.models import DispatchAttempt, Pandit
from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import LAT, LNG, _auth, _make_pandit, _token


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _pandit_id(phone: str) -> str:
    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.phone == phone))).scalar_one()
        return str(p.id)


async def test_preferred_pandit_is_offered_first(
    client: AsyncClient, admin_token, service_id
):
    # Nearest partner (~0.1 km) and a slightly farther one — both eligible.
    await _make_pandit("+910000006001", 26.4512, 80.3311, service_id)  # nearest
    await _make_pandit("+910000006002", 26.4550, 80.3360, service_id)  # a bit farther
    farther_id = await _pandit_id("+910000006002")

    ctok = await _token(client, "+919000006000", "customer")
    r = await client.post(
        "/api/v1/mp/customer/bookings",
        headers=_auth(ctok),
        json={
            "service_slug": "published-puja",
            "mode": "immediate",
            "preferred_pandit_id": farther_id,
            "address_line": "Test addr",
            "lat": LAT,
            "lng": LNG,
        },
    )
    assert r.status_code == 201, r.text
    bid = r.json()["id"]

    # The first (and so far only) offer must be to the chosen, farther pandit —
    # even though another partner is nearer.
    async with TestSession() as s:
        offers = (
            await s.execute(
                select(DispatchAttempt).where(DispatchAttempt.booking_id == bid)
            )
        ).scalars().all()
        assert len(offers) == 1
        assert str(offers[0].pandit_id) == farther_id


async def test_preferred_unapproved_rejected(client: AsyncClient, service_id):
    await _make_pandit(
        "+910000006003", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    unapproved_id = await _pandit_id("+910000006003")
    ctok = await _token(client, "+919000006001", "customer")
    r = await client.post(
        "/api/v1/mp/customer/bookings",
        headers=_auth(ctok),
        json={
            "service_slug": "published-puja",
            "mode": "immediate",
            "preferred_pandit_id": unapproved_id,
            "address_line": "Test addr",
            "lat": LAT,
            "lng": LNG,
        },
    )
    assert r.status_code == 409, r.text
