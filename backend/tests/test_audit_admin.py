"""Audit-log viewer + permissions matrix: filtering, RBAC, matrix shape."""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.constants import AdminStatus
from app.core.security import hash_password
from app.marketplace.constants import Availability, PanditStatus, StaffRole
from app.marketplace.models import Pandit
from app.models.admin_user import AdminUser
from tests.conftest import TestSession


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest_asyncio.fixture
async def pandit_id() -> str:
    async with TestSession() as s:
        p = Pandit(
            phone="+919000000001", name="P", base_lat=26.4, base_lng=80.3,
            status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
        )
        s.add(p)
        await s.commit()
        return str(p.id)


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


async def _generate_audit(client: AsyncClient, admin_token: str, pandit_id: str) -> None:
    # A real audited action: a verification decision writes an audit_log row.
    res = await client.post(
        f"/api/v1/mp/admin/pandits/{pandit_id}/verification-decision",
        headers=_auth(admin_token),
        json={"decision": "approve", "reason": "looks good"},
    )
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_viewer_lists_and_filters(client: AsyncClient, admin_token, pandit_id):
    await _generate_audit(client, admin_token, pandit_id)

    res = await client.get("/api/v1/mp/admin/audit", headers=_auth(admin_token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1
    row = next(r for r in body["items"] if r["action"] == "mp.verification.decision")
    assert row["actor_email"] is not None
    assert row["entity"] == "pandit"
    assert row["meta"]["decision"] == "approve"  # before/after context preserved

    # Filter by action.
    f = await client.get(
        "/api/v1/mp/admin/audit?action=mp.verification.decision", headers=_auth(admin_token)
    )
    assert all(r["action"] == "mp.verification.decision" for r in f.json()["items"])

    # Free-text search on the entity.
    g = await client.get("/api/v1/mp/admin/audit?q=pandit", headers=_auth(admin_token))
    assert g.json()["total"] >= 1


@pytest.mark.asyncio
async def test_meta_and_permissions(client: AsyncClient, admin_token, pandit_id):
    await _generate_audit(client, admin_token, pandit_id)

    meta = await client.get("/api/v1/mp/admin/audit/meta", headers=_auth(admin_token))
    assert meta.status_code == 200
    assert "mp.verification.decision" in meta.json()["actions"]
    assert "pandit" in meta.json()["entities"]

    perms = await client.get("/api/v1/mp/admin/audit/permissions", headers=_auth(admin_token))
    assert perms.status_code == 200, perms.text
    data = perms.json()
    assert "ops" in data["roles"] and "admin" in data["roles"]
    finance_row = next(m for m in data["modules"] if m["module"] == "Finance")
    assert finance_row["roles"] == ["finance"]
    audit_row = next(m for m in data["modules"] if m["module"] == "Audit log")
    assert audit_row["roles"] == ["admin"]


@pytest.mark.asyncio
async def test_rbac_super_admin_only(client: AsyncClient):
    # Even an ops staffer cannot read the audit log — super-admin only.
    await _make_staff("ops@panditjiexpress.in", StaffRole.OPS)
    otok = await _staff_token(client, "ops@panditjiexpress.in")
    assert (await client.get("/api/v1/mp/admin/audit", headers=_auth(otok))).status_code == 403
    assert (
        await client.get("/api/v1/mp/admin/audit/permissions", headers=_auth(otok))
    ).status_code == 403
