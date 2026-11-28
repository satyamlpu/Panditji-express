"""Finance reporting & reconciliation: totals, ledger feed, refunds, RBAC."""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import BookingStatus, LedgerType, StaffRole
from app.marketplace.models import Booking, Customer, LedgerEntry, Payment, Refund
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


async def _seed_finance(service_id: str) -> None:
    async with TestSession() as s:
        cust = Customer(phone="+919999900000", name="Asha")
        s.add(cust)
        await s.flush()
        b = Booking(
            code="PJ-FIN001", customer_id=cust.id, service_id=uuid.UUID(service_id),
            mode="immediate", status=BookingStatus.COMPLETED, address_line="A",
            dest_lat=LAT, dest_lng=LNG, service_title_snapshot="Published Puja",
            price_paise=210000,
        )
        s.add(b)
        await s.flush()
        pay = Payment(
            booking_id=b.id, amount_paise=210000, status="partially_refunded",
            provider_order_id="order_fin1", provider_payment_id="pay_fin1",
            refunded_paise=50000,
        )
        s.add(pay)
        await s.flush()
        # A full set of ledger entries for one paid booking + a payout + a refund.
        def _le(etype, amt, settled=False):
            return LedgerEntry(
                booking_id=b.id, payment_id=pay.id, entry_type=etype,
                amount_paise=amt, settled=settled,
            )

        s.add_all([
            _le(LedgerType.CUSTOMER_CHARGE, 210000),
            _le(LedgerType.GATEWAY_FEE, 4200),
            _le(LedgerType.PLATFORM_COMMISSION, 31500),
            _le(LedgerType.PARTNER_PAYABLE, 174300, settled=True),
            _le(LedgerType.REFUND, 50000),
            LedgerEntry(entry_type=LedgerType.PAYOUT, amount_paise=174300, settled=True),
        ])
        s.add(Refund(
            payment_id=pay.id, amount_paise=50000, status="processed",
            reason="partial refund", provider_refund_id="rfnd_fin1",
            created_by="finance@panditjiexpress.in",
        ))
        await s.commit()


@pytest.mark.asyncio
async def test_reconciliation_totals(client: AsyncClient, admin_token, service_id):
    await _seed_finance(service_id)
    res = await client.get(
        "/api/v1/mp/admin/finance/reconciliation?days=30", headers=_auth(admin_token)
    )
    assert res.status_code == 200, res.text
    t = res.json()["totals"]
    assert t["gross_booking_value_paise"] == 210000
    assert t["platform_commission_paise"] == 31500
    assert t["gateway_fees_paise"] == 4200
    assert t["refunds_paise"] == 50000
    assert t["payouts_paise"] == 174300
    assert t["net_platform_revenue_paise"] == 31500 - 4200  # commission − gateway
    assert t["outstanding_payable_paise"] == 174300 - 174300  # fully paid out
    assert len(res.json()["by_day"]) >= 1


@pytest.mark.asyncio
async def test_ledger_feed_filter(client: AsyncClient, admin_token, service_id):
    await _seed_finance(service_id)
    full = await client.get("/api/v1/mp/admin/finance/ledger", headers=_auth(admin_token))
    assert full.status_code == 200 and full.json()["total"] == 6

    comm = await client.get(
        f"/api/v1/mp/admin/finance/ledger?entry_type={LedgerType.PLATFORM_COMMISSION}",
        headers=_auth(admin_token),
    )
    items = comm.json()["items"]
    assert all(i["entry_type"] == "platform_commission" for i in items)
    assert items[0]["booking_code"] == "PJ-FIN001"


@pytest.mark.asyncio
async def test_refunds_history(client: AsyncClient, admin_token, service_id):
    await _seed_finance(service_id)
    res = await client.get("/api/v1/mp/admin/finance/refunds", headers=_auth(admin_token))
    assert res.status_code == 200
    r = res.json()[0]
    assert r["amount_paise"] == 50000
    assert r["booking_code"] == "PJ-FIN001"
    assert r["created_by"] == "finance@panditjiexpress.in"


@pytest.mark.asyncio
async def test_rbac_finance_only(client: AsyncClient, service_id):
    await _make_staff("ops@panditjiexpress.in", StaffRole.OPS)
    otok = await _staff_token(client, "ops@panditjiexpress.in")
    r = await client.get(
        "/api/v1/mp/admin/finance/reconciliation", headers=_auth(otok)
    )
    assert r.status_code == 403
