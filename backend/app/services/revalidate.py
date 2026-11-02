"""Tell the Next.js frontend to revalidate pages after content is published.

This is what makes routine content edits appear on the public site without a
redeploy: the admin saves, the backend POSTs the affected cache tags to the
frontend's /api/revalidate route, and Next re-renders those pages on demand.

Best-effort: a revalidation failure never breaks the admin save (time-based ISR
is the fallback). Fired as a background task so the request stays fast.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("panditji")


async def revalidate_tags(tags: list[str]) -> None:
    if not settings.frontend_revalidate_url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                settings.frontend_revalidate_url,
                json={"tags": tags},
                headers={"x-revalidate-secret": settings.revalidate_secret},
            )
    except Exception as exc:  # pragma: no cover - network best-effort
        logger.warning("Revalidation of %s failed: %s", tags, exc)
