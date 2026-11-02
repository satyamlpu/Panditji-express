"""Public read API: published-only visibility and the sitemap."""

from __future__ import annotations

from httpx import AsyncClient


async def test_public_lists_only_published(client: AsyncClient):
    res = await client.get("/api/v1/public/services")
    assert res.status_code == 200
    slugs = [s["slug"] for s in res.json()]
    assert "published-puja" in slugs
    assert "draft-puja" not in slugs


async def test_public_detail_published(client: AsyncClient):
    res = await client.get("/api/v1/public/services/published-puja")
    assert res.status_code == 200
    body = res.json()
    assert body["price_display"] == "₹2,100"
    assert body["seo"]["canonical_path"] == "/puja-services/published-puja"


async def test_public_detail_draft_is_404(client: AsyncClient):
    res = await client.get("/api/v1/public/services/draft-puja")
    assert res.status_code == 404


async def test_sitemap_excludes_draft(client: AsyncClient):
    res = await client.get("/api/v1/public/sitemap")
    assert res.status_code == 200
    paths = [e["path"] for e in res.json()]
    assert "/puja-services/published-puja" in paths
    assert "/puja-services/draft-puja" not in paths
