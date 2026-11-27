"""Operations analytics: real booking data aggregated into a daily trend, top
services and window totals/rates over the last N days (ops-gated)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import BookingStatus
from app.marketplace.models import Booking, Customer
from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import _auth


@pytest_asyncio.fixture
async def seeded_bookings() -> None:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        cust = Customer(phone="+919111100000", name="Analytics Cust")
        s.add(cust)
        await s.flush()
        now = datetime.now(UTC)

        def mk(status: str, days_ago: int, price: int | None = 50000) -> Booking:
            return Booking(
                code=f"BK{uuid.uuid4().hex[:8]}",
                customer_id=cust.id,
                service_id=svc.id,
                mode="immediate",
                status=status,
                address_line="Test addr",
                dest_lat=26.45,
                dest_lng=80.33,
                service_title_snapshot=svc.title,
                price_paise=price,
                created_at=now - timedelta(days=days_ago),
            )

        s.add_all(
            [
                mk(BookingStatus.COMPLETED, 0),
                mk(BookingStatus.COMPLETED, 1),
                mk(BookingStatus.NO_PARTNER, 1, price=None),
                mk(BookingStatus.CANCELLED_CUSTOMER, 2),
                mk(BookingStatus.REQUESTED, 0),
            ]
        )
        await s.commit()


async def test_analytics_totals_and_daily(
    client: AsyncClient, admin_token, seeded_bookings
):
    r = await client.get(
        "/api/v1/mp/admin/analytics", params={"days": 7}, headers=_auth(admin_token)
    )
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["days"] == 7
    assert len(data["daily"]) == 7  # one bucket per day, gaps filled with zeros

    t = data["totals"]
    assert t["bookings"] == 5
    assert t["completed"] == 2
    assert t["no_partner"] == 1
    assert t["cancelled"] == 1
    assert t["completion_rate"] == 0.4  # 2 / 5
    assert t["no_match_rate"] == 0.2  # 1 / 5
    # GMV only counts completed bookings' price (2 × ₹500 = ₹1000).
    assert t["gmv_paise"] == 100000
    assert t["gmv_display"]

    # Top services: the one seeded service with all 5 bookings.
    assert data["top_services"][0]["bookings"] == 5

    # Daily completed count on the most recent day includes today's completed one.
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    today_bucket = next(d for d in data["daily"] if d["date"] == today)
    assert today_bucket["completed"] == 1
    assert today_bucket["total"] == 2  # one completed + one requested today


async def test_analytics_requires_staff(client: AsyncClient):
    r = await client.get("/api/v1/mp/admin/analytics")
    assert r.status_code == 401


async def test_analytics_empty_window_is_zeroed(client: AsyncClient, admin_token):
    r = await client.get(
        "/api/v1/mp/admin/analytics", params={"days": 14}, headers=_auth(admin_token)
    )
    assert r.status_code == 200
    data = r.json()
    assert data["totals"]["bookings"] == 0
    assert data["totals"]["completion_rate"] == 0.0
    assert len(data["daily"]) == 14
    assert data["top_services"] == []
