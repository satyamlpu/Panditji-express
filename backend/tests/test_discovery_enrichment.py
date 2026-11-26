"""Discovery enrichment: nearby-pandit results carry an ETA, a price estimate
and the pandit's experience/specialisation; onboarding persists those fields."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.models import Pandit
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


async def _set_profile(phone: str, *, years: int, spec: str) -> None:
    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.phone == phone))).scalar_one()
        p.experience_years = years
        p.specialisation = spec
        await s.commit()


async def test_search_includes_eta_price_and_profile(
    client: AsyncClient, service_id
):
    await _make_pandit("+910000007001", LAT, LNG, service_id)
    await _set_profile("+910000007001", years=12, spec="Vedic havan & griha pravesh")

    r = await client.get(
        "/api/v1/mp/discovery/pandits",
        params={"service_slug": "published-puja", "lat": LAT, "lng": LNG},
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    item = items[0]

    # ETA: a positive integer number of minutes derived from distance.
    assert isinstance(item["eta_minutes"], int) and item["eta_minutes"] >= 1
    # Price estimate: non-empty, and matches the catalogue price for the service.
    assert item["price_display"]
    svc = await client.get(
        "/api/v1/mp/discovery/services"
    )
    price = next(
        s["price_display"] for s in svc.json() if s["slug"] == "published-puja"
    )
    assert item["price_display"] == price
    # Profile enrichment surfaced.
    assert item["experience_years"] == 12
    assert item["specialisation"] == "Vedic havan & griha pravesh"


async def test_eta_grows_with_distance(client: AsyncClient, service_id):
    # Same spot as the customer → smallest ETA; a farther (but in-radius) pandit
    # → a larger ETA.
    await _make_pandit("+910000007002", LAT, LNG, service_id)  # ~0 km
    await _make_pandit("+910000007003", 26.50, 80.40, service_id)  # several km away

    r = await client.get(
        "/api/v1/mp/discovery/pandits",
        params={"service_slug": "published-puja", "lat": LAT, "lng": LNG},
    )
    items = r.json()
    assert len(items) == 2
    # Results are nearest-first, so ETA is non-decreasing down the list.
    etas = [i["eta_minutes"] for i in items]
    assert etas == sorted(etas)
    assert etas[1] > etas[0]


async def test_onboard_persists_experience_and_specialisation(client: AsyncClient):
    tok = await _token(client, "+910000007004", "pandit")
    r = await client.post(
        "/api/v1/mp/partner/onboard",
        headers=_auth(tok),
        json={
            "name": "Pandit Sharma",
            "languages": ["hi", "sa"],
            "base_lat": LAT,
            "base_lng": LNG,
            "service_radius_km": 15,
            "service_slugs": ["published-puja"],
            "experience_years": 18,
            "specialisation": "Rudrabhishek",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["experience_years"] == 18
    assert body["specialisation"] == "Rudrabhishek"

    prof = await client.get("/api/v1/mp/partner/profile", headers=_auth(tok))
    assert prof.json()["experience_years"] == 18
    assert prof.json()["specialisation"] == "Rudrabhishek"
