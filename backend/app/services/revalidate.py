"""Tell the Next.js frontend to revalidate pages after content is published.

This is what makes routine content edits appear on the public site without a
redeploy: the admin saves, the backend POSTs the affected cache tags to the
frontend's /api/revalidate route, and Next re-renders those pages on demand.

Best-effort: a revalidation failure never breaks the admin save (time-based ISR
is the fallback). Fired as a background task so the request stays fast.

The *outcome* of the most recent attempt is recorded in ``LAST_RESULT`` and
every attempt is logged, so a misconfigured production webhook (the classic
"my edits don't show up") becomes observable via the admin Sync Status panel
instead of failing silently.
"""

from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("panditji")


@dataclass
class RevalidateResult:
    ok: bool
    detail: str
    tags: list[str]
    at: float  # epoch seconds

    def as_dict(self) -> dict:
        return asdict(self)


# Module-level record of the latest revalidation attempt (observability only).
LAST_RESULT: RevalidateResult | None = None


async def _post(tags: list[str], *, timeout: float = 5.0) -> RevalidateResult:
    if not settings.frontend_revalidate_url:
        return RevalidateResult(
            ok=False,
            detail="FRONTEND_REVALIDATE_URL is not configured — on-demand "
            "revalidation is disabled; edits appear only after the ISR window.",
            tags=tags,
            at=time.time(),
        )
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                settings.frontend_revalidate_url,
                json={"tags": tags},
                headers={"x-revalidate-secret": settings.revalidate_secret},
            )
        if resp.status_code == 403:
            return RevalidateResult(
                ok=False,
                detail="Frontend rejected the revalidation secret (403). The "
                "backend REVALIDATE_SECRET must match the frontend's.",
                tags=tags,
                at=time.time(),
            )
        if resp.status_code >= 400:
            return RevalidateResult(
                ok=False,
                detail=f"Frontend returned HTTP {resp.status_code}.",
                tags=tags,
                at=time.time(),
            )
        return RevalidateResult(ok=True, detail="ok", tags=tags, at=time.time())
    except Exception as exc:
        return RevalidateResult(
            ok=False,
            detail=f"Could not reach the frontend revalidation webhook: {exc}",
            tags=tags,
            at=time.time(),
        )


async def revalidate_tags(tags: list[str]) -> None:
    """Fire-and-forget revalidation of the given cache tags (background task)."""
    global LAST_RESULT
    result = await _post(tags)
    LAST_RESULT = result
    if result.ok:
        logger.info("Revalidated frontend tags %s", tags)
    else:
        logger.warning("Revalidation of %s failed: %s", tags, result.detail)


async def check_revalidation() -> RevalidateResult:
    """Actively probe the frontend webhook with a harmless empty-tag request.

    Used by the admin Sync Status panel to confirm the publish→reflect path is
    wired end to end, without touching any content.
    """
    return await _post([], timeout=4.0)
