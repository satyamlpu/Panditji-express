"""Partner onboarding lifecycle: interview scheduling + completion, and
re-verification — the CRM approval states beyond plain approve/reject."""

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


async def _decide(client, admin_token, pid, decision, reason=None):
    return await client.post(
        f"/api/v1/mp/admin/pandits/{pid}/verification-decision",
        headers=_auth(admin_token),
        json={"decision": decision, "reason": reason},
    )


async def test_interview_then_approve(client: AsyncClient, admin_token, service_id):
    pid = await _make_pandit(
        "+910000005001", LAT, LNG, service_id,
        status=PanditStatus.UNDER_REVIEW, availability=Availability.OFFLINE,
    )

    r = await _decide(client, admin_token, pid, "schedule_interview", "Fri 3pm")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == PanditStatus.INTERVIEW_SCHEDULED

    r = await _decide(client, admin_token, pid, "complete_interview", "Went well")
    assert r.json()["status"] == PanditStatus.INTERVIEW_COMPLETED

    r = await _decide(client, admin_token, pid, "approve", "Cleared")
    assert r.json()["status"] == PanditStatus.APPROVED


async def test_require_reverification_blocks_going_online(
    client: AsyncClient, admin_token, service_id
):
    pid = await _make_pandit(
        "+910000005002", LAT, LNG, service_id,
        status=PanditStatus.APPROVED, availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000005002", "pandit")

    # An approved partner can go online.
    on = await client.patch(
        "/api/v1/mp/partner/availability",
        headers=_auth(ptok),
        json={"availability": "online"},
    )
    assert on.status_code == 200, on.text

    # Admin flags re-verification → not approved anymore.
    r = await _decide(client, admin_token, pid, "require_reverification", "Docs expired")
    assert r.json()["status"] == PanditStatus.REVERIFICATION_REQUIRED
    assert r.json()["availability"] == Availability.OFFLINE  # forced offline

    # Now the partner can no longer go online.
    blocked = await client.patch(
        "/api/v1/mp/partner/availability",
        headers=_auth(ptok),
        json={"availability": "online"},
    )
    assert blocked.status_code == 409
