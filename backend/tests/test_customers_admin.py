"""Admin Customers CRM: directory, 360 profile, tabs, mutations, RBAC."""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import StaffRole
from app.models.admin_user import AdminUser
from app.models.service import Service
from tests.conftest import TestSession

LAT, LNG = 26.45, 80.33


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def _customer_token(client: AsyncClient, phone: str) -> str:
    code = (
        await client.post(
            "/api/v1/mp/auth/otp/request", json={"phone": phone, "kind": "customer"}
        )
    ).json()["dev_code"]
    res = await client.post(
        "/api/v1/mp/auth/otp/verify",
        json={"phone": phone, "kind": "customer", "code": code},
    )
    return res.json()["access_token"]


async def _book(client: AsyncClient, ctok: str) -> dict:
    res = await client.post(
        "/api/v1/mp/customer/bookings",
        headers=_auth(ctok),
        json={
            "service_slug": "published-puja", "mode": "immediate",
            "address_line": "Test addr, Kanpur", "lat": LAT, "lng": LNG,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


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


@pytest.mark.asyncio
async def test_directory_lists_customers_with_aggregates(
    client: AsyncClient, admin_token, service_id
):
    ctok = await _customer_token(client, "+919999900000")
    await client.patch(
        "/api/v1/mp/customer/profile", headers=_auth(ctok), json={"name": "Asha Rai"}
    )
    await _book(client, ctok)

    res = await client.get("/api/v1/mp/admin/customers", headers=_auth(admin_token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1
    row = next(r for r in body["items"] if r["phone"] == "+919999900000")
    assert row["name"] == "Asha Rai"
    assert row["bookings_count"] >= 1
    assert row["status"] == "active"
    assert "total_spent_display" in row


@pytest.mark.asyncio
async def test_search_and_filter(client: AsyncClient, admin_token):
    await _customer_token(client, "+919999900001")
    await _customer_token(client, "+918888800002")

    res = await client.get(
        "/api/v1/mp/admin/customers?q=8888", headers=_auth(admin_token)
    )
    assert res.status_code == 200
    phones = [r["phone"] for r in res.json()["items"]]
    assert phones == ["+918888800002"]


@pytest.mark.asyncio
async def test_profile_tabs(client: AsyncClient, admin_token, service_id):
    ctok = await _customer_token(client, "+919999900003")
    await client.post(
        "/api/v1/mp/customer/addresses", headers=_auth(ctok),
        json={"label": "Home", "line": "12 MG Road", "lat": LAT, "lng": LNG},
    )
    await _book(client, ctok)

    cid = next(
        r["id"]
        for r in (
            await client.get("/api/v1/mp/admin/customers", headers=_auth(admin_token))
        ).json()["items"]
        if r["phone"] == "+919999900003"
    )

    detail = await client.get(
        f"/api/v1/mp/admin/customers/{cid}", headers=_auth(admin_token)
    )
    assert detail.status_code == 200, detail.text
    assert len(detail.json()["addresses"]) == 1

    bookings = await client.get(
        f"/api/v1/mp/admin/customers/{cid}/bookings", headers=_auth(admin_token)
    )
    assert bookings.status_code == 200 and len(bookings.json()) >= 1

    for tab in ("payments", "reviews", "tickets", "activity"):
        r = await client.get(
            f"/api/v1/mp/admin/customers/{cid}/{tab}", headers=_auth(admin_token)
        )
        assert r.status_code == 200, f"{tab}: {r.text}"
        assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_edit_suspend_reactivate_lifecycle(client: AsyncClient, admin_token):
    ctok = await _customer_token(client, "+919999900004")
    cid = next(
        r["id"]
        for r in (
            await client.get("/api/v1/mp/admin/customers", headers=_auth(admin_token))
        ).json()["items"]
        if r["phone"] == "+919999900004"
    )

    edit = await client.patch(
        f"/api/v1/mp/admin/customers/{cid}", headers=_auth(admin_token),
        json={"name": "Renamed"},
    )
    assert edit.status_code == 200 and edit.json()["name"] == "Renamed"

    # Suspend requires a reason; takes effect immediately on the customer API.
    bad = await client.post(
        f"/api/v1/mp/admin/customers/{cid}/suspend", headers=_auth(admin_token), json={}
    )
    assert bad.status_code == 422  # reason required

    susp = await client.post(
        f"/api/v1/mp/admin/customers/{cid}/suspend", headers=_auth(admin_token),
        json={"reason": "fraud review"},
    )
    assert susp.status_code == 200 and susp.json()["status"] == "suspended"

    denied = await client.get("/api/v1/mp/customer/profile", headers=_auth(ctok))
    assert denied.status_code == 403  # suspended account loses API access

    react = await client.post(
        f"/api/v1/mp/admin/customers/{cid}/reactivate", headers=_auth(admin_token),
        json={"reason": "cleared"},
    )
    assert react.status_code == 200 and react.json()["status"] == "active"

    ok = await client.get("/api/v1/mp/customer/profile", headers=_auth(ctok))
    assert ok.status_code == 200

    # The account activity tab now records suspend + reactivate.
    acts = (
        await client.get(
            f"/api/v1/mp/admin/customers/{cid}/activity", headers=_auth(admin_token)
        )
    ).json()
    actions = {a["action"] for a in acts}
    assert "mp.customer.suspend" in actions and "mp.customer.reactivate" in actions


@pytest.mark.asyncio
async def test_rbac_and_export_gate(client: AsyncClient, admin_token):
    await _customer_token(client, "+919999900005")
    cid = next(
        r["id"]
        for r in (
            await client.get("/api/v1/mp/admin/customers", headers=_auth(admin_token))
        ).json()["items"]
        if r["phone"] == "+919999900005"
    )

    # A finance-only staffer may NOT view customers.
    await _make_staff("finance@panditjiexpress.in", StaffRole.FINANCE)
    ftok = await _staff_token(client, "finance@panditjiexpress.in")
    assert (
        await client.get("/api/v1/mp/admin/customers", headers=_auth(ftok))
    ).status_code == 403

    # A support staffer MAY view but NOT export (super-admin only).
    await _make_staff("support@panditjiexpress.in", StaffRole.SUPPORT)
    stok = await _staff_token(client, "support@panditjiexpress.in")
    assert (
        await client.get("/api/v1/mp/admin/customers", headers=_auth(stok))
    ).status_code == 200
    assert (
        await client.get(
            f"/api/v1/mp/admin/customers/{cid}/export", headers=_auth(stok)
        )
    ).status_code == 403

    # Super-admin can export; the export is audited.
    exp = await client.get(
        f"/api/v1/mp/admin/customers/{cid}/export", headers=_auth(admin_token)
    )
    assert exp.status_code == 200, exp.text
    assert exp.json()["profile"]["phone"] == "+919999900005"
