"""Admin service CRUD: price edit propagation, slug-change redirects, drafts."""

from __future__ import annotations

from httpx import AsyncClient


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_price_edit_reflects_on_public(client: AsyncClient, admin_token: str):
    # Find the published service id
    listing = await client.get("/api/v1/admin/services", headers=_auth(admin_token))
    svc = next(s for s in listing.json()["items"] if s["slug"] == "published-puja")

    res = await client.patch(
        f"/api/v1/admin/services/{svc['id']}",
        headers=_auth(admin_token),
        json={"price_rupees": 3500},
    )
    assert res.status_code == 200
    assert res.json()["price_display"] == "₹3,500"

    pub = await client.get("/api/v1/public/services/published-puja")
    assert pub.json()["price_display"] == "₹3,500"


async def test_slug_change_creates_redirect(client: AsyncClient, admin_token: str):
    listing = await client.get("/api/v1/admin/services", headers=_auth(admin_token))
    svc = next(s for s in listing.json()["items"] if s["slug"] == "published-puja")

    res = await client.patch(
        f"/api/v1/admin/services/{svc['id']}",
        headers=_auth(admin_token),
        json={"slug": "renamed-puja"},
    )
    assert res.status_code == 200

    redirect = await client.get(
        "/api/v1/public/redirects", params={"path": "/puja-services/published-puja"}
    )
    assert redirect.status_code == 200
    assert redirect.json()["to_path"] == "/puja-services/renamed-puja"


async def test_duplicate_slug_conflict(client: AsyncClient, admin_token: str):
    res = await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={"slug": "published-puja", "title": "Clashing Puja"},
    )
    assert res.status_code == 409


async def test_create_draft_not_public(client: AsyncClient, admin_token: str):
    res = await client.post(
        "/api/v1/admin/services",
        headers=_auth(admin_token),
        json={"slug": "new-draft", "title": "New Draft", "status": "draft"},
    )
    assert res.status_code == 201
    pub = await client.get("/api/v1/public/services/new-draft")
    assert pub.status_code == 404
