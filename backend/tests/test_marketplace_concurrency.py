"""Milestone 1 — transactional safety of the booking/money core.

Two layers are exercised:

* **Invariant tests** (run on every dialect, including the local SQLite run):
  the partial unique indexes and the service-level guards reject the unsafe
  outcome deterministically, in sequence.
* **True-concurrency tests** (``pg_only`` — PostgreSQL has real ``SELECT … FOR
  UPDATE`` row locks; SQLite does not): the same operations fired in parallel
  through independent sessions resolve to exactly one winner.

Together they cover: double booking assignment, duplicate payment webhooks,
over-refund, and double payout.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.errors import APIError
from app.marketplace import dispatch, finance
from app.marketplace.constants import (
    Availability,
    BookingStatus,
    DispatchOutcome,
    LedgerType,
    PaymentStatus,
)
from app.marketplace.models import (
    Booking,
    DispatchAttempt,
    LedgerEntry,
    Pandit,
    Payment,
    Payout,
)
from app.models.service import Service
from tests.conftest import IS_SQLITE, TestSession
from tests.test_marketplace import LAT, LNG, _auth, _book, _make_pandit, _token
from tests.test_marketplace_finance import _completed, _order, _webhook

pg_only = pytest.mark.skipif(
    IS_SQLITE,
    reason="true-concurrency serialization needs PostgreSQL row locks (SELECT "
    "FOR UPDATE); verified in CI on PostgreSQL. SQLite covers the invariants.",
)


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


# ── setup helpers ────────────────────────────────────────────────────────────
async def _two_live_offers(client: AsyncClient, service_id):
    """A booking awaiting acceptance with a *live* offer to two partners.

    Returns ``(booking_id, pid_a, pid_b)``. Mirrors the race the audit flagged:
    two partners can each hold an open offer for the same booking.
    """
    pid_a = await _make_pandit("+910000003001", LAT, LNG, service_id)
    pid_b = await _make_pandit("+910000003002", LAT, LNG, service_id)
    ctok = await _token(client, "+919999900000", "customer")
    booking = await _book(client, ctok)
    bid = uuid.UUID(booking["id"])
    assert booking["status"] == BookingStatus.AWAITING_ACCEPTANCE

    async with TestSession() as s:
        offered = (
            await s.execute(
                select(DispatchAttempt.pandit_id).where(
                    DispatchAttempt.booking_id == bid,
                    DispatchAttempt.outcome == DispatchOutcome.OFFERED,
                )
            )
        ).scalars().all()
        have = {str(p) for p in offered}
        # Give whichever partner wasn't auto-offered an equal live offer, so the
        # two accepts genuinely contend for the same booking.
        now = datetime.now(UTC)
        for pid in (pid_a, pid_b):
            if pid not in have:
                s.add(
                    DispatchAttempt(
                        booking_id=bid,
                        pandit_id=uuid.UUID(pid),
                        rank=2,
                        distance_km=0.1,
                        offered_at=now,
                        expires_at=now + timedelta(seconds=60),
                        outcome=DispatchOutcome.OFFERED,
                    )
                )
        await s.commit()
    return bid, pid_a, pid_b


async def _accept(pid: str, bid) -> tuple[str, object]:
    """Run accept_offer in its own committed session; report ok/err."""
    async with TestSession() as s:
        try:
            p = (
                await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))
            ).scalar_one()
            b = await dispatch.accept_offer(s, p, bid)
            await s.commit()
            return "ok", str(b.assigned_pandit_id)
        except Exception as exc:
            await s.rollback()
            return "err", type(exc).__name__


async def _accepted_count(bid) -> int:
    async with TestSession() as s:
        return (
            await s.execute(
                select(func.count())
                .select_from(DispatchAttempt)
                .where(
                    DispatchAttempt.booking_id == bid,
                    DispatchAttempt.outcome == DispatchOutcome.ACCEPTED,
                )
            )
        ).scalar_one()


# ── booking assignment ───────────────────────────────────────────────────────
async def test_unique_index_rejects_second_accepted(client: AsyncClient, service_id):
    """The partial unique index is the durable backstop: a booking can hold at
    most one ACCEPTED attempt, enforced by the database on any dialect."""
    bid, pid_a, pid_b = await _two_live_offers(client, service_id)

    async with TestSession() as s:
        a = (
            await s.execute(
                select(DispatchAttempt).where(
                    DispatchAttempt.booking_id == bid,
                    DispatchAttempt.pandit_id == uuid.UUID(pid_a),
                )
            )
        ).scalar_one()
        a.outcome = DispatchOutcome.ACCEPTED
        await s.commit()

    with pytest.raises(IntegrityError):
        async with TestSession() as s:
            b = (
                await s.execute(
                    select(DispatchAttempt).where(
                        DispatchAttempt.booking_id == bid,
                        DispatchAttempt.pandit_id == uuid.UUID(pid_b),
                    )
                )
            ).scalar_one()
            b.outcome = DispatchOutcome.ACCEPTED
            await s.flush()


async def test_sequential_double_accept_one_winner(client: AsyncClient, service_id):
    bid, pid_a, pid_b = await _two_live_offers(client, service_id)

    r1 = await _accept(pid_a, bid)
    r2 = await _accept(pid_b, bid)

    assert r1 == ("ok", pid_a)
    assert r2[0] == "err"  # booking no longer awaiting → clean conflict
    assert await _accepted_count(bid) == 1

    async with TestSession() as s:
        booking = (await s.execute(select(Booking).where(Booking.id == bid))).scalar_one()
        assert booking.status == BookingStatus.CONFIRMED
        assert str(booking.assigned_pandit_id) == pid_a
        winner = (
            await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid_a)))
        ).scalar_one()
        loser = (
            await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid_b)))
        ).scalar_one()
        assert winner.availability == Availability.BUSY
        assert loser.availability == Availability.ONLINE  # never assigned


@pg_only
async def test_parallel_double_accept_one_winner(client: AsyncClient, service_id):
    bid, pid_a, pid_b = await _two_live_offers(client, service_id)

    r_a, r_b = await asyncio.gather(_accept(pid_a, bid), _accept(pid_b, bid))

    oks = [r for r in (r_a, r_b) if r[0] == "ok"]
    assert len(oks) == 1  # exactly one partner confirmed
    assert await _accepted_count(bid) == 1
    async with TestSession() as s:
        booking = (await s.execute(select(Booking).where(Booking.id == bid))).scalar_one()
        assert booking.status == BookingStatus.CONFIRMED
        assert str(booking.assigned_pandit_id) == oks[0][1]


# ── payment webhooks ─────────────────────────────────────────────────────────
@pg_only
async def test_parallel_duplicate_webhook_single_ledger(client: AsyncClient, service_id):
    booking, ctok, _, _ = await _completed(client, service_id, phone="+910000003010")
    order = await _order(client, ctok, booking["id"])
    oid = order["provider_order_id"]

    async def fire():
        async with TestSession() as s:
            try:
                await finance.record_paid(s, oid, "pay_parallel_dup")
                await s.commit()
                return "ok"
            except Exception as exc:
                await s.rollback()
                return type(exc).__name__

    await asyncio.gather(fire(), fire())

    async with TestSession() as s:
        charges = (
            await s.execute(
                select(func.count())
                .select_from(LedgerEntry)
                .where(LedgerEntry.entry_type == LedgerType.CUSTOMER_CHARGE)
            )
        ).scalar_one()
    assert charges == 1  # posted exactly once despite concurrent webhooks


# ── refunds ──────────────────────────────────────────────────────────────────
async def _paid_payment_id(client: AsyncClient, service_id, phone) -> tuple[str, int]:
    booking, ctok, _, _ = await _completed(client, service_id, phone=phone)
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_" + phone[-4:])
    return order["payment_id"], None


async def _refund_full(payment_id: str) -> str:
    async with TestSession() as s:
        try:
            p = (
                await s.execute(select(Payment).where(Payment.id == uuid.UUID(payment_id)))
            ).scalar_one()
            await finance.create_refund(
                s, p, amount_paise=None, reason="concurrency test", actor="tester"
            )
            await s.commit()
            return "ok"
        except Exception as exc:
            await s.rollback()
            return type(exc).__name__


async def test_sequential_refund_cannot_exceed(client: AsyncClient, service_id):
    pid, _ = await _paid_payment_id(client, service_id, phone="+910000003020")

    assert await _refund_full(pid) == "ok"
    second = await _refund_full(pid)  # already fully refunded
    assert second != "ok"

    async with TestSession() as s:
        p = (await s.execute(select(Payment).where(Payment.id == uuid.UUID(pid)))).scalar_one()
        assert p.refunded_paise == p.amount_paise  # never over-refunded
        assert p.status == PaymentStatus.REFUNDED
        refund_total = (
            await s.execute(
                select(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).where(
                    LedgerEntry.entry_type == LedgerType.REFUND,
                    LedgerEntry.payment_id == uuid.UUID(pid),
                )
            )
        ).scalar_one()
        assert refund_total == p.amount_paise


@pg_only
async def test_parallel_refund_cannot_exceed(client: AsyncClient, service_id):
    pid, _ = await _paid_payment_id(client, service_id, phone="+910000003021")

    results = await asyncio.gather(_refund_full(pid), _refund_full(pid))
    assert results.count("ok") == 1  # only one full refund succeeds

    async with TestSession() as s:
        p = (await s.execute(select(Payment).where(Payment.id == uuid.UUID(pid)))).scalar_one()
        assert p.refunded_paise == p.amount_paise


# ── payouts ──────────────────────────────────────────────────────────────────
async def _payout(pid: str) -> str:
    async with TestSession() as s:
        try:
            await finance.process_payout(s, uuid.UUID(pid), actor="tester")
            await s.commit()
            return "ok"
        except Exception as exc:
            await s.rollback()
            return type(exc).__name__


async def test_sequential_double_payout_pays_once(client: AsyncClient, service_id):
    booking, ctok, _, pid = await _completed(client, service_id, phone="+910000003030")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_po_seq")

    assert await _payout(pid) == "ok"
    with pytest.raises(APIError):  # nothing left to pay out
        async with TestSession() as s:
            await finance.process_payout(s, uuid.UUID(pid), actor="tester")

    async with TestSession() as s:
        payouts = (
            await s.execute(
                select(func.count()).select_from(Payout).where(
                    Payout.pandit_id == uuid.UUID(pid)
                )
            )
        ).scalar_one()
        assert payouts == 1
        payout_entries = (
            await s.execute(
                select(func.count()).select_from(LedgerEntry).where(
                    LedgerEntry.entry_type == LedgerType.PAYOUT,
                    LedgerEntry.pandit_id == uuid.UUID(pid),
                )
            )
        ).scalar_one()
        assert payout_entries == 1


@pg_only
async def test_parallel_double_payout_pays_once(client: AsyncClient, service_id):
    booking, ctok, _, pid = await _completed(client, service_id, phone="+910000003031")
    order = await _order(client, ctok, booking["id"])
    await _webhook(client, order["provider_order_id"], payment_id="pay_po_par")

    results = await asyncio.gather(_payout(pid), _payout(pid))
    assert results.count("ok") == 1

    async with TestSession() as s:
        payouts = (
            await s.execute(
                select(func.count()).select_from(Payout).where(
                    Payout.pandit_id == uuid.UUID(pid)
                )
            )
        ).scalar_one()
        assert payouts == 1


# ── suspended partner access ─────────────────────────────────────────────────
async def test_suspended_pandit_loses_api_access(client: AsyncClient, service_id):
    from app.marketplace.constants import PanditStatus

    phone = "+910000003040"
    pid = await _make_pandit(phone, LAT, LNG, service_id)
    ptok = await _token(client, phone, "pandit")

    ok = await client.get("/api/v1/mp/partner/booking-requests", headers=_auth(ptok))
    assert ok.status_code == 200  # approved partner works

    async with TestSession() as s:
        p = (await s.execute(select(Pandit).where(Pandit.id == uuid.UUID(pid)))).scalar_one()
        p.status = PanditStatus.SUSPENDED
        await s.commit()

    blocked = await client.get("/api/v1/mp/partner/booking-requests", headers=_auth(ptok))
    assert blocked.status_code == 403  # same token, access revoked immediately
