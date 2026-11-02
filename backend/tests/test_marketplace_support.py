"""Phase 3: support tickets — lifecycle, scope, threaded replies."""

from __future__ import annotations

from httpx import AsyncClient

from tests.test_marketplace import _auth, _token


async def _ticket(client: AsyncClient, ctok, subject="Puja timing") -> dict:
    res = await client.post(
        "/api/v1/mp/customer/support/tickets",
        headers=_auth(ctok),
        json={"subject": subject, "body": "Can we move the slot to 7pm?"},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_customer_create_list_reply(client: AsyncClient):
    ctok = await _token(client, "+919999900000", "customer")
    t = await _ticket(client, ctok)
    assert t["status"] == "open"

    mine = (await client.get("/api/v1/mp/customer/support/tickets", headers=_auth(ctok))).json()
    assert any(x["ref"] == t["ref"] for x in mine)

    detail = (
        await client.get(f"/api/v1/mp/customer/support/tickets/{t['id']}", headers=_auth(ctok))
    ).json()
    assert len(detail["messages"]) == 1  # the opening message

    reply = await client.post(
        f"/api/v1/mp/customer/support/tickets/{t['id']}/reply",
        headers=_auth(ctok), json={"body": "Any update?"},
    )
    assert reply.status_code == 200
    assert len(reply.json()["messages"]) == 2


async def test_ticket_scope(client: AsyncClient):
    c1 = await _token(client, "+919999900000", "customer")
    t = await _ticket(client, c1)
    c2 = await _token(client, "+918888800000", "customer")  # different customer
    res = await client.get(
        f"/api/v1/mp/customer/support/tickets/{t['id']}", headers=_auth(c2)
    )
    assert res.status_code == 404  # cannot see another customer's ticket


async def test_admin_assign_reply_resolve(client: AsyncClient, admin_token):
    ctok = await _token(client, "+919999900000", "customer")
    t = await _ticket(client, ctok)

    # Staff sees it in the queue.
    q = (await client.get("/api/v1/mp/admin/support/tickets", headers=_auth(admin_token))).json()
    assert any(x["ref"] == t["ref"] for x in q)

    assigned = await client.post(
        f"/api/v1/mp/admin/support/tickets/{t['id']}/assign",
        headers=_auth(admin_token), json={},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "assigned"
    assert assigned.json()["assignee_email"]

    await client.post(
        f"/api/v1/mp/admin/support/tickets/{t['id']}/reply",
        headers=_auth(admin_token), json={"body": "Done — moved to 7pm."},
    )

    # Resolving requires a resolution note.
    bad = await client.post(
        f"/api/v1/mp/admin/support/tickets/{t['id']}/status",
        headers=_auth(admin_token), json={"status": "resolved"},
    )
    assert bad.status_code == 422

    ok = await client.post(
        f"/api/v1/mp/admin/support/tickets/{t['id']}/status",
        headers=_auth(admin_token),
        json={"status": "resolved", "resolution": "Slot rescheduled."},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "resolved"

    # Customer sees the admin reply + resolution; cannot reply to a closed ticket.
    detail = (
        await client.get(
            f"/api/v1/mp/customer/support/tickets/{t['id']}", headers=_auth(ctok)
        )
    ).json()
    assert any(m["author"].startswith("admin:") for m in detail["messages"])
    assert detail["resolution"] == "Slot rescheduled."

    closed_reply = await client.post(
        f"/api/v1/mp/customer/support/tickets/{t['id']}/reply",
        headers=_auth(ctok), json={"body": "thanks"},
    )
    assert closed_reply.status_code == 409


async def test_admin_support_requires_staff(client: AsyncClient):
    assert (await client.get("/api/v1/mp/admin/support/tickets")).status_code == 401
