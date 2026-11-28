"""SEO settings: admin writes the `seo` key; the public settings feed exposes it
(so the site can apply defaults, OG image, Organization JSON-LD and no-index)."""

from __future__ import annotations

from httpx import AsyncClient


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_admin_sets_seo_and_public_exposes_it(client: AsyncClient, admin_token):
    value = {
        "title_suffix": " · Pandit Ji Express",
        "default_description": "Book verified pandits for pujas.",
        "noindex": True,
        "organization": {"name": "Pandit Ji Express", "same_as": ["https://x.com/pje"]},
    }
    r = await client.put(
        "/api/v1/admin/settings/seo",
        headers=_auth(admin_token),
        json={"value": value},
    )
    assert r.status_code == 200, r.text

    pub = await client.get("/api/v1/public/settings")
    assert pub.status_code == 200
    seo = pub.json().get("seo")
    assert seo is not None
    assert seo["noindex"] is True
    assert seo["organization"]["name"] == "Pandit Ji Express"


async def test_seo_write_requires_admin(client: AsyncClient):
    r = await client.put("/api/v1/admin/settings/seo", json={"value": {"noindex": True}})
    assert r.status_code == 401
