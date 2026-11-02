"""Public enquiry submission: validation, honeypot and persistence."""

from __future__ import annotations

from httpx import AsyncClient


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_enquiry_submits_and_is_visible_to_admin(
    client: AsyncClient, admin_token: str
):
    res = await client.post(
        "/api/v1/public/enquiries",
        json={
            "service_slug": "published-puja",
            "name": "Asha",
            "phone": "+91 9000000000",
            "message": "Please call",
        },
    )
    assert res.status_code == 201

    listing = await client.get("/api/v1/admin/enquiries", headers=_auth(admin_token))
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert any(e["name"] == "Asha" for e in items)
    assert items[0]["service_title_snapshot"] == "Published Puja"


async def test_honeypot_silently_drops(client: AsyncClient, admin_token: str):
    res = await client.post(
        "/api/v1/public/enquiries",
        json={
            "name": "Bot",
            "phone": "+91 9000000000",
            "website": "http://spam.example",  # honeypot filled → dropped
        },
    )
    assert res.status_code == 201  # looks successful to the bot

    listing = await client.get("/api/v1/admin/enquiries", headers=_auth(admin_token))
    assert all(e["name"] != "Bot" for e in listing.json()["items"])


async def test_enquiry_validation_rejects_bad_phone(client: AsyncClient):
    res = await client.post(
        "/api/v1/public/enquiries",
        json={"name": "Asha", "phone": "not-a-number"},
    )
    assert res.status_code == 422
