"""Phase 3: payments (server-verified), ledger, refunds, payouts and reviews."""

from __future__ import annotations

import json
import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select

from app.marketplace.finance import sign_payload
from app.marketplace.models import LedgerEntry, Pandit
from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import LAT, LNG, _auth, _book, _make_pandit, _token


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _completed(client: AsyncClient, service_id, phone="+910000002001"):
    """Book → accept → advance to completed. Returns (booking, ctok, ptok, pid)."""
    pid = await _make_pandit(phone, LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    ptok = await _token(client, phone, "pandit")
    await client.post(
        f"/api/v1/mp/partner/booking-requests/{booking['id']}/accept",
        headers=_auth(ptok),
    )
    for to in ("en_route", "arrived", "in_progress", "completed"):
        await client.post(
            f"/api/v1/mp/partner/bookings/{booking['id']}/status",
            headers=_auth(ptok),
            json={"to_status": to},
        )
    return booking, ctok, ptok, pid


async def _order(client: AsyncClient, ctok, booking_id) -> dict:
    res = await client.post(
        f"/api/v1/mp/customer/bookings/{booking_id}/pay", headers=_auth(ctok)
    )
    assert res.status_code == 200, res.text
    return res.json()


async def _webhook(client: AsyncClient, order_id, payment_id="pay_test_1"):
    body = json.dumps(
        {"provider_order_id": order_id, "provider_payment_id": payment_id, "status": "paid"}
    ).encode()
    return await client.post(
        "/api/v1/mp/payments/webhooks/mock",
        content=body,
        headers={"x-mock-signature": sign_payload(body), "content-type": "application/json"},
    )


async def test_payment_requires_signed_webhook(client: AsyncClient, service_id):
    booking, ctok, _, _ = await _completed(client, service_id)
    order = await _order(client, ctok, booking["id"])

    # Unsigned webhook is rejected — a client call never confirms payment.
    bad = await client.post(
        "/api/v1/mp/payments/webhooks/mock",
        json={"provider_order_id": order["provider_order_id"],
              "provider_payment_id": "x", "status": "paid"},
    )
    assert bad.status_code == 401

    ok = await _webhook(client, order["provider_order_id"])
    assert ok.status_code == 200
    assert ok.json()["status"] == "paid"

    # Ledger posted: charge, gateway fee, commission, partner payable.
    async with TestSession() as s:
        kinds = (
            await s.execute(select(LedgerEntry.entry_type))
        ).scalars().all()
    expected = {"customer_charge", "gateway_fee", "platform_commission", "partner_payable"}
    assert expected <= set(kinds)


async def test_webhook_idempotent(client: AsyncClient, service_id):
    booking, ctok, _, _ = await _completed(client, service_id)
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_dup")
    await _webhook(client, order["provider_order_id"], payment_id="pay_dup")  # duplicate

    async with TestSession() as s:
        charges = (
            await s.execute(
                select(func.count()).select_from(LedgerEntry).where(
                    LedgerEntry.entry_type == "customer_charge"
                )
            )
        ).scalar_one()
    assert charges == 1  # not double-posted


async def test_refund_requires_reason_and_caps(client: AsyncClient, admin_token, service_id):
    booking, ctok, _, _ = await _completed(client, service_id)
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_rf")
    payment_id = order["payment_id"]

    no_reason = await client.post(
        f"/api/v1/mp/admin/finance/payments/{payment_id}/refund",
        headers=_auth(admin_token), json={},
    )
    assert no_reason.status_code == 422

    over = await client.post(
        f"/api/v1/mp/admin/finance/payments/{payment_id}/refund",
        headers=_auth(admin_token),
        json={"amount_paise": 99999999, "reason": "too much"},
    )
    assert over.status_code == 422

    ok = await client.post(
        f"/api/v1/mp/admin/finance/payments/{payment_id}/refund",
        headers=_auth(admin_token), json={"reason": "customer request"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "refunded"


async def test_payout_flow(client: AsyncClient, admin_token, service_id):
    booking, ctok, _, pid = await _completed(client, service_id, phone="+910000002002")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_po")

    due = (
        await client.get("/api/v1/mp/admin/finance/payouts", headers=_auth(admin_token))
    ).json()
    mine = [d for d in due if d["pandit_id"] == pid]
    assert mine and mine[0]["amount_paise"] > 0

    paid = await client.post(
        "/api/v1/mp/admin/finance/payouts",
        headers=_auth(admin_token), json={"pandit_id": pid},
    )
    assert paid.status_code == 200
    assert paid.json()["amount_paise"] == mine[0]["amount_paise"]

    due2 = (
        await client.get("/api/v1/mp/admin/finance/payouts", headers=_auth(admin_token))
    ).json()
    assert all(d["pandit_id"] != pid for d in due2)  # settled


async def test_review_only_on_completed_and_once(client: AsyncClient, service_id):
    booking, ctok, _, pid = await _completed(client, service_id, phone="+910000002003")
    r1 = await client.post(
        f"/api/v1/mp/customer/bookings/{booking['id']}/review",
        headers=_auth(ctok), json={"rating": 5, "comment": "Excellent"},
    )
    assert r1.status_code == 201
    r2 = await client.post(
        f"/api/v1/mp/customer/bookings/{booking['id']}/review",
        headers=_auth(ctok), json={"rating": 3},
    )
    assert r2.status_code == 409  # one per booking

    async with TestSession() as s:
        p = (
            await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))
        ).scalar_one()
    assert p.rating_count == 1 and p.rating_sum == 5


async def test_finance_requires_staff(client: AsyncClient):
    assert (await client.get("/api/v1/mp/admin/finance/summary")).status_code == 401
