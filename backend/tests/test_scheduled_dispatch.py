"""Scheduled-booking dispatch: a cron-polled endpoint dispatches scheduled
bookings whose time has arrived (and only those), guarded by a shared secret."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace.constants import BookingMode, BookingStatus
from app.marketplace.models import Booking, Customer
from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import LAT, LNG, _make_pandit

SECRET = "sched-secret-xyz"


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


async def _mk_scheduled(service_id: str, *, when: datetime) -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.id == uuid.UUID(service_id)))
        ).scalar_one()
        cust = Customer(phone=f"+9190000{uuid.uuid4().hex[:5]}", name="Sched Cust")
        s.add(cust)
        await s.flush()
        b = Booking(
            code=f"BK{uuid.uuid4().hex[:8]}",
            customer_id=cust.id,
            service_id=svc.id,
            mode=BookingMode.SCHEDULED,
            status=BookingStatus.REQUESTED,
            address_line="Test addr",
            dest_lat=LAT,
            dest_lng=LNG,
            service_title_snapshot=svc.title,
            price_paise=svc.price_paise,
            scheduled_at=when,
        )
        s.add(b)
        await s.commit()
        return str(b.id)


async def _status(bid: str) -> str:
    async with TestSession() as s:
        b = (
            await s.execute(select(Booking).where(Booking.id == uuid.UUID(bid)))
        ).scalar_one()
        return b.status


async def test_due_scheduled_booking_is_dispatched(
    client: AsyncClient, service_id, monkeypatch
):
    from app.core import config

    monkeypatch.setattr(config.settings, "scheduler_secret", SECRET, raising=False)
    # A partner who can take the booking once it dispatches.
    await _make_pandit("+910000009001", LAT, LNG, service_id)

    now = datetime.now(UTC)
    due = await _mk_scheduled(service_id, when=now - timedelta(minutes=5))
    future = await _mk_scheduled(service_id, when=now + timedelta(hours=3))

    r = await client.post(
        "/api/v1/mp/admin/scheduler/dispatch-due",
        headers={"X-Scheduler-Token": SECRET},
    )
    assert r.status_code == 200, r.text
    assert r.json()["dispatched"] == 1

    # Due booking left `requested` (dispatch started); future one untouched.
    assert await _status(due) != BookingStatus.REQUESTED
    assert await _status(future) == BookingStatus.REQUESTED

    # Idempotent: a second run dispatches nothing more.
    r2 = await client.post(
        "/api/v1/mp/admin/scheduler/dispatch-due",
        headers={"X-Scheduler-Token": SECRET},
    )
    assert r2.json()["dispatched"] == 0


async def test_disabled_without_secret(client: AsyncClient, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "scheduler_secret", "", raising=False)
    r = await client.post(
        "/api/v1/mp/admin/scheduler/dispatch-due",
        headers={"X-Scheduler-Token": "anything"},
    )
    assert r.status_code == 503


async def test_wrong_token_rejected(client: AsyncClient, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "scheduler_secret", SECRET, raising=False)
    r = await client.post(
        "/api/v1/mp/admin/scheduler/dispatch-due",
        headers={"X-Scheduler-Token": "wrong"},
    )
    assert r.status_code == 401

    # Missing header too.
    r2 = await client.post("/api/v1/mp/admin/scheduler/dispatch-due")
    assert r2.status_code == 401
