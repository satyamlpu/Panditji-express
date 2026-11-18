"""Partner KYC verification flow: submit documents → admin review → decision."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import Availability, PanditStatus
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


async def test_verification_flow(client: AsyncClient, admin_token, service_id):
    pid = await _make_pandit(
        "+910000004001",
        LAT,
        LNG,
        service_id,
        status=PanditStatus.SUBMITTED,
        availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000004001", "pandit")

    # initially: submitted, no documents
    v0 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v0["status"] == "submitted"
    assert v0["documents"] == []

    # partner submits a KYC document → status moves to under_review
    r = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        json={"doc_type": "id_proof", "reference": "Aadhaar — last 4: 1234"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"

    v1 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v1["status"] == "under_review"
    assert len(v1["documents"]) == 1
    assert v1["documents"][0]["doc_type"] == "id_proof"

    # admin can see the submitted documents for review
    docs = (
        await client.get(
            f"/api/v1/mp/admin/pandits/{pid}/documents", headers=_auth(admin_token)
        )
    ).json()
    assert len(docs) == 1
    assert docs[0]["reference"] == "Aadhaar — last 4: 1234"

    # admin approves → partner becomes approved
    dec = await client.post(
        f"/api/v1/mp/admin/pandits/{pid}/verification-decision",
        headers=_auth(admin_token),
        json={"decision": "approve"},
    )
    assert dec.status_code == 200, dec.text
    assert dec.json()["status"] == "approved"

    v2 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v2["status"] == "approved"

    # once approved, further submissions are rejected
    dup = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        json={"doc_type": "id_proof"},
    )
    assert dup.status_code == 409


async def test_verification_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/mp/partner/verification")).status_code == 401
    assert (
        await client.get("/api/v1/mp/admin/pandits/00000000-0000-0000-0000-000000000000/documents")
    ).status_code == 401
