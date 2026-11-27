"""Reviews filtering + support queue metrics (deepened consoles)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import BookingStatus, PanditStatus, TicketStatus
from app.marketplace.models import (
    Booking,
    Customer,
    Pandit,
    Review,
    SupportTicket,
)
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


async def _seed_reviews(service_id: str) -> None:
    async with TestSession() as s:
        cust = Customer(phone="+919999900000", name="Asha")
        pandit = Pandit(phone="+919000000001", name="P", base_lat=LAT, base_lng=LNG,
                        status=PanditStatus.APPROVED, availability="online")
        s.add_all([cust, pandit])
        await s.flush()
        svc = uuid.UUID(service_id)

        def _bk(code):
            b = Booking(code=code, customer_id=cust.id, service_id=svc, mode="immediate",
                        status=BookingStatus.COMPLETED, address_line="A", dest_lat=LAT,
                        dest_lng=LNG, service_title_snapshot="Published Puja",
                        price_paise=210000, assigned_pandit_id=pandit.id)
            s.add(b)
            return b

        b1, b2, b3 = _bk("PJ-R1"), _bk("PJ-R2"), _bk("PJ-R3")
        await s.flush()
        def _rv(b, rating, **kw):
            return Review(
                booking_id=b.id, customer_id=cust.id, pandit_id=pandit.id,
                rating=rating, **kw,
            )

        s.add_all([
            _rv(b1, 5),
            _rv(b2, 1, reported=True),
            _rv(b3, 2, hidden=True),
        ])
        await s.commit()


async def _seed_tickets() -> None:
    async with TestSession() as s:
        opener = uuid.uuid4()

        def _t(ref, status, assignee=None, age_h=1):
            return SupportTicket(
                ref=ref, opener_kind="customer", opener_id=opener, subject=f"Issue {ref}",
                status=status, assignee_email=assignee,
                created_at=datetime.now(UTC) - timedelta(hours=age_h),
            )

        s.add_all([
            _t("T-OPEN", TicketStatus.OPEN, age_h=2),            # unassigned, recent
            _t("T-OLD", TicketStatus.OPEN, age_h=48),            # unassigned, SLA breach
            _t("T-ASG", TicketStatus.ASSIGNED, "s@x.in", age_h=5),
            _t("T-ESC", TicketStatus.ESCALATED, "s@x.in", age_h=30),  # SLA breach
            _t("T-RES", TicketStatus.RESOLVED, "s@x.in", age_h=1),
        ])
        await s.commit()


@pytest.mark.asyncio
async def test_reviews_filters(client: AsyncClient, admin_token, service_id):
    await _seed_reviews(service_id)

    all_r = await client.get("/api/v1/mp/admin/reviews", headers=_auth(admin_token))
    assert all_r.status_code == 200 and len(all_r.json()) == 3

    rep = await client.get("/api/v1/mp/admin/reviews?reported=true", headers=_auth(admin_token))
    assert [r["booking_code"] for r in rep.json()] == ["PJ-R2"]

    hid = await client.get("/api/v1/mp/admin/reviews?hidden=true", headers=_auth(admin_token))
    assert [r["booking_code"] for r in hid.json()] == ["PJ-R3"]

    one_star = await client.get("/api/v1/mp/admin/reviews?rating=1", headers=_auth(admin_token))
    assert all(r["rating"] == 1 for r in one_star.json()) and len(one_star.json()) == 1


@pytest.mark.asyncio
async def test_support_metrics(client: AsyncClient, admin_token):
    await _seed_tickets()
    res = await client.get(
        "/api/v1/mp/admin/support/metrics?sla_threshold_hours=24", headers=_auth(admin_token)
    )
    assert res.status_code == 200, res.text
    m = res.json()
    assert m["open"] == 2 and m["assigned"] == 1 and m["escalated"] == 1
    assert m["unassigned"] == 2  # both OPEN tickets have no assignee
    assert m["sla_breaches"] == 2  # T-OLD (48h) + T-ESC (30h)
    assert m["oldest_open_hours"] >= 47
    assert m["sla_threshold_hours"] == 24
