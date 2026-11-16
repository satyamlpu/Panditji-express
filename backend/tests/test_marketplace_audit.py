"""A-1 regression tests: refund / payout / reassign each write exactly ONE
central audit_log row (no router-level duplicate), carrying the authenticated
actor id + verified client IP, with the correct entity/action — and the audit
row stays atomic with the financial mutation (a failed audit rolls the mutation
back, leaving no unaudited money change).
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select

from app.marketplace.constants import MpAudit, PaymentStatus
from app.marketplace.models import Payment, Refund
from app.models.admin_user import AdminUser
from app.models.audit import AuditLog
from app.models.service import Service
from tests.conftest import ADMIN_EMAIL, TestSession
from tests.test_marketplace import LAT, LNG, _auth, _book, _make_pandit, _token
from tests.test_marketplace_finance import _completed, _order, _webhook


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _admin_id() -> str:
    async with TestSession() as s:
        a = (
            await s.execute(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))
        ).scalar_one()
        return str(a.id)


async def _audit_rows(action: str, entity_id: str | None = None):
    async with TestSession() as s:
        q = select(AuditLog).where(AuditLog.action == action)
        if entity_id is not None:
            q = q.where(AuditLog.entity_id == str(entity_id))
        return (await s.execute(q.order_by(AuditLog.created_at))).scalars().all()


async def test_refund_writes_single_enriched_audit_row(
    client: AsyncClient, admin_token, service_id
):
    booking, ctok, _, _ = await _completed(client, service_id, phone="+910000003001")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_audit_rf")
    payment_id = order["payment_id"]

    ok = await client.post(
        f"/api/v1/mp/admin/finance/payments/{payment_id}/refund",
        headers=_auth(admin_token),
        json={"reason": "customer request"},
    )
    assert ok.status_code == 200, ok.text

    rows = await _audit_rows(MpAudit.REFUND, entity_id=payment_id)
    assert len(rows) == 1  # exactly one central row (no router duplicate)
    row = rows[0]
    assert row.entity == "payment"
    assert row.entity_id == str(payment_id)
    assert str(row.actor_id) == await _admin_id()  # authenticated actor id
    assert row.actor_email == ADMIN_EMAIL
    assert row.ip  # verified client address recorded
    # the P0 duplicate action string must no longer be written
    assert await _audit_rows("mp.finance.refund") == []


async def test_payout_writes_single_enriched_audit_row(
    client: AsyncClient, admin_token, service_id
):
    booking, ctok, _, pid = await _completed(client, service_id, phone="+910000003002")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_audit_po")

    paid = await client.post(
        "/api/v1/mp/admin/finance/payouts",
        headers=_auth(admin_token),
        json={"pandit_id": pid},
    )
    assert paid.status_code == 200, paid.text

    rows = await _audit_rows(MpAudit.PAYOUT)
    assert len(rows) == 1
    row = rows[0]
    assert row.entity == "payout"  # correct entity type (not "pandit")
    assert row.entity_id and row.entity_id != pid  # the payout id, not the pandit id
    assert row.meta and row.meta.get("pandit_id") == pid
    assert str(row.actor_id) == await _admin_id()
    assert row.ip
    assert await _audit_rows("mp.finance.payout") == []


async def test_reassign_writes_single_enriched_audit_row(
    client: AsyncClient, admin_token, service_id
):
    p1 = await _make_pandit("+910000003010", LAT, LNG, service_id)
    p2 = await _make_pandit("+910000003011", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    ptok1 = await _token(client, "+910000003010", "pandit")
    accept = await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept",
        headers=_auth(ptok1),
    )
    assigned = accept.json()["assigned_pandit"]["id"] if accept.status_code == 200 else None
    other = p2 if assigned == p1 else p1

    res = await client.post(
        f"/api/v1/mp/admin/bookings/{booking['id']}/reassign",
        headers=_auth(admin_token),
        json={"pandit_id": other, "reason": "partner unreachable"},
    )
    assert res.status_code == 200, res.text

    # action == "mp.booking.reassign"; before the fix the identical router call
    # produced a SECOND row with the same action — so == 1 proves de-duplication.
    rows = await _audit_rows(MpAudit.MANUAL_REASSIGN, entity_id=booking["id"])
    assert len(rows) == 1
    row = rows[0]
    assert row.entity == "booking"
    assert str(row.actor_id) == await _admin_id()
    assert row.ip


async def test_refund_rolls_back_when_audit_fails(
    client: AsyncClient, admin_token, service_id, monkeypatch
):
    """A failed audit write must roll back the whole refund — no unaudited money."""
    booking, ctok, _, _ = await _completed(client, service_id, phone="+910000003003")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_audit_fail")
    payment_id = order["payment_id"]

    async def _boom(*args, **kwargs):
        raise RuntimeError("audit store down")

    # Patch the name as bound inside the finance module (atomic with the refund).
    monkeypatch.setattr("app.marketplace.finance.audit", _boom)

    with pytest.raises(RuntimeError):
        await client.post(
            f"/api/v1/mp/admin/finance/payments/{payment_id}/refund",
            headers=_auth(admin_token),
            json={"reason": "customer request"},
        )

    async with TestSession() as s:
        p = (
            await s.execute(select(Payment).where(Payment.id == uuid.UUID(payment_id)))
        ).scalar_one()
        assert p.status == PaymentStatus.PAID  # not refunded
        assert p.refunded_paise == 0
        refunds = (
            await s.execute(select(func.count()).select_from(Refund))
        ).scalar_one()
        assert refunds == 0  # no orphan refund row
        audits = (
            await s.execute(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.action == MpAudit.REFUND)
            )
        ).scalar_one()
        assert audits == 0  # and no audit row either
