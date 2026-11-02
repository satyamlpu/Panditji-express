"""Phase 3/4 content: public visibility and admin RBAC on the new routers."""

from __future__ import annotations

from httpx import AsyncClient


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Admin RBAC: every new admin router denies anonymous access ───────────────
async def test_new_admin_routers_require_auth(client: AsyncClient):
    for path in (
        "/api/v1/admin/locations",
        "/api/v1/admin/testimonials",
        "/api/v1/admin/faqs",
        "/api/v1/admin/pages",
        "/api/v1/admin/homepage-sections",
        "/api/v1/admin/settings",
    ):
        res = await client.get(path)
        assert res.status_code == 401, path


# ── Pages: created draft is hidden; publishing exposes it ────────────────────
async def test_page_publish_flow(client: AsyncClient, admin_token: str):
    created = await client.post(
        "/api/v1/admin/pages",
        headers=_auth(admin_token),
        json={"slug": "about-us", "title": "About", "body": "# Hi", "status": "draft"},
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    assert (await client.get("/api/v1/public/pages/about-us")).status_code == 404

    pub = await client.patch(
        f"/api/v1/admin/pages/{pid}",
        headers=_auth(admin_token),
        json={"status": "published"},
    )
    assert pub.status_code == 200
    got = await client.get("/api/v1/public/pages/about-us")
    assert got.status_code == 200
    assert got.json()["seo"]["canonical_path"] == "/about-us"


# ── Locations: availability associations drive the public detail ─────────────
async def test_location_services_association(client: AsyncClient, admin_token: str):
    svc = (
        await client.get("/api/v1/admin/services", headers=_auth(admin_token))
    ).json()["items"]
    published = next(s for s in svc if s["slug"] == "published-puja")

    loc = await client.post(
        "/api/v1/admin/locations",
        headers=_auth(admin_token),
        json={"slug": "delhi", "city": "Delhi", "status": "published"},
    )
    assert loc.status_code == 201
    lid = loc.json()["id"]

    # Initially no services linked.
    detail = await client.get("/api/v1/public/locations/delhi")
    assert detail.status_code == 200
    assert detail.json()["services"] == []

    # Associate the published service.
    assoc = await client.put(
        f"/api/v1/admin/locations/{lid}/services",
        headers=_auth(admin_token),
        json={"service_ids": [published["id"]]},
    )
    assert assoc.status_code == 200

    detail = await client.get("/api/v1/public/locations/delhi")
    slugs = [s["slug"] for s in detail.json()["services"]]
    assert slugs == ["published-puja"]


# ── Testimonials: only published are public ──────────────────────────────────
async def test_testimonial_visibility(client: AsyncClient, admin_token: str):
    await client.post(
        "/api/v1/admin/testimonials",
        headers=_auth(admin_token),
        json={"author_name": "Draft Person", "quote": "hidden quote", "status": "draft"},
    )
    await client.post(
        "/api/v1/admin/testimonials",
        headers=_auth(admin_token),
        json={"author_name": "Live Person", "quote": "visible quote", "status": "published"},
    )
    pub = await client.get("/api/v1/public/testimonials")
    names = [t["author_name"] for t in pub.json()]
    assert "Live Person" in names
    assert "Draft Person" not in names


# ── Media: type restriction ──────────────────────────────────────────────────
async def test_media_rejects_non_image(client: AsyncClient, admin_token: str):
    res = await client.post(
        "/api/v1/admin/media",
        headers=_auth(admin_token),
        files={"file": ("x.txt", b"hello", "text/plain")},
    )
    assert res.status_code == 415
