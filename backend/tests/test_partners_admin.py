"""Admin Partner management CRM: directory, 360 overview, earnings, RBAC."""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    LedgerType,
    PanditStatus,
    StaffRole,
)
from app.marketplace.models import (
    Booking,
    Customer,
    LedgerEntry,
    Pandit,
    PanditCapability,
    Payout,
    Review,
)
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
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


async def _seed_partner_with_history(service_id: str) -> str:
    """An approved partner with a completed booking, a payable and a payout."""
    async with TestSession() as s:
        p = Pandit(
            phone="+919000000001", name="Pandit Sharma", city="Kanpur",
            base_lat=LAT, base_lng=LNG, service_radius_km=15.0,
            status=PanditStatus.APPROVED, availability=Availability.ONLINE,
            offers_received=4, offers_accepted=3, rating_sum=9, rating_count=2,
        )
        s.add(p)
        await s.flush()
        s.add(PanditCapability(pandit_id=p.id, service_id=uuid.UUID(service_id)))
        cust = Customer(phone="+919999900000", name="Asha")
        s.add(cust)
        await s.flush()
        b = Booking(
            code="PJ-TEST01", customer_id=cust.id, service_id=uuid.UUID(service_id),
            mode="immediate", status=BookingStatus.COMPLETED,
            address_line="12 MG Road", dest_lat=LAT, dest_lng=LNG,
            service_title_snapshot="Published Puja", price_paise=210000,
            assigned_pandit_id=p.id,
        )
        s.add(b)
        await s.flush()
        s.add(
            Review(
                booking_id=b.id, customer_id=cust.id, pandit_id=p.id,
                rating=5, comment="Great",
            )
        )
        # One settled payable + a matching payout, and one still-outstanding payable.
        s.add_all([
            LedgerEntry(
                booking_id=b.id, pandit_id=p.id,
                entry_type=LedgerType.PARTNER_PAYABLE, amount_paise=170000, settled=True,
            ),
            LedgerEntry(
                pandit_id=p.id, entry_type=LedgerType.PAYOUT,
                amount_paise=170000, settled=True,
            ),
            LedgerEntry(
                pandit_id=p.id, entry_type=LedgerType.PARTNER_PAYABLE,
                amount_paise=50000, settled=False,
            ),
        ])
        s.add(Payout(pandit_id=p.id, amount_paise=170000, bookings_count=1, status="paid"))
        await s.commit()
        return str(p.id)


@pytest.mark.asyncio
async def test_directory_aggregates_and_filters(client: AsyncClient, admin_token, service_id):
    pid = await _seed_partner_with_history(service_id)

    res = await client.get("/api/v1/mp/admin/partners", headers=_auth(admin_token))
    assert res.status_code == 200, res.text
    body = res.json()
    row = next(r for r in body["items"] if r["id"] == pid)
    assert row["capability_count"] == 1
    assert row["completed_count"] == 1
    assert row["rating_avg"] == 4.5
    assert row["acceptance_rate"] == 0.75
    assert row["outstanding_paise"] == 50000

    # Search by city + status filter.
    s1 = await client.get("/api/v1/mp/admin/partners?q=kanpur", headers=_auth(admin_token))
    assert pid in [r["id"] for r in s1.json()["items"]]
    s2 = await client.get(
        f"/api/v1/mp/admin/partners?status={PanditStatus.APPROVED}", headers=_auth(admin_token)
    )
    assert pid in [r["id"] for r in s2.json()["items"]]
    s3 = await client.get(
        f"/api/v1/mp/admin/partners?status={PanditStatus.REJECTED}", headers=_auth(admin_token)
    )
    assert pid not in [r["id"] for r in s3.json()["items"]]


@pytest.mark.asyncio
async def test_overview_performance_and_earnings(client: AsyncClient, admin_token, service_id):
    pid = await _seed_partner_with_history(service_id)

    ov = await client.get(f"/api/v1/mp/admin/partners/{pid}/overview", headers=_auth(admin_token))
    assert ov.status_code == 200, ov.text
    data = ov.json()
    assert data["performance"]["completed_count"] == 1
    assert data["performance"]["acceptance_rate"] == 0.75
    assert data["performance"]["rating_avg"] == 4.5
    assert data["earnings"]["lifetime_earned_paise"] == 220000  # 170000 + 50000
    assert data["earnings"]["paid_out_paise"] == 170000
    assert data["earnings"]["outstanding_paise"] == 50000
    assert len(data["capabilities"]) == 1


@pytest.mark.asyncio
async def test_earnings_and_tabs(client: AsyncClient, admin_token, service_id):
    pid = await _seed_partner_with_history(service_id)

    earn = await client.get(f"/api/v1/mp/admin/partners/{pid}/earnings", headers=_auth(admin_token))
    assert earn.status_code == 200, earn.text
    ebody = earn.json()
    assert len(ebody["payouts"]) == 1 and ebody["payouts"][0]["amount_paise"] == 170000
    assert len(ebody["entries"]) == 3  # 2 payable + 1 payout

    bookings = await client.get(
        f"/api/v1/mp/admin/partners/{pid}/bookings", headers=_auth(admin_token)
    )
    assert bookings.status_code == 200 and len(bookings.json()) == 1

    reviews = await client.get(
        f"/api/v1/mp/admin/partners/{pid}/reviews", headers=_auth(admin_token)
    )
    assert reviews.status_code == 200 and reviews.json()[0]["rating"] == 5


@pytest.mark.asyncio
async def test_rbac(client: AsyncClient, admin_token, service_id):
    await _seed_partner_with_history(service_id)
    # Partners are ops/verification only — finance and support are denied.
    await _make_staff("fin@panditjiexpress.in", StaffRole.FINANCE)
    await _make_staff("ver@panditjiexpress.in", StaffRole.VERIFICATION)
    ftok = await _staff_token(client, "fin@panditjiexpress.in")
    vtok = await _staff_token(client, "ver@panditjiexpress.in")
    assert (await client.get("/api/v1/mp/admin/partners", headers=_auth(ftok))).status_code == 403
    assert (await client.get("/api/v1/mp/admin/partners", headers=_auth(vtok))).status_code == 200
