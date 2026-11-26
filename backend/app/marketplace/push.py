"""Device push-token registry.

The apps register their FCM / APNs / Expo push token here. The delivery transport
that actually sends to these tokens is added later (it needs provider
credentials). A token is unique, so registering is idempotent — re-registering an
existing token just re-points it at the current principal/platform.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.marketplace.models import PushToken


async def register(
    session: AsyncSession,
    *,
    principal_kind: str,
    principal_id: str,
    token: str,
    platform: str,
) -> None:
    existing = (
        await session.execute(select(PushToken).where(PushToken.token == token))
    ).scalar_one_or_none()
    pid = uuid.UUID(principal_id)
    if existing:
        existing.principal_kind = principal_kind
        existing.principal_id = pid
        existing.platform = platform
    else:
        session.add(
            PushToken(
                token=token,
                principal_kind=principal_kind,
                principal_id=pid,
                platform=platform,
            )
        )
    await session.flush()


async def unregister(session: AsyncSession, *, token: str) -> None:
    existing = (
        await session.execute(select(PushToken).where(PushToken.token == token))
    ).scalar_one_or_none()
    if existing:
        await session.delete(existing)
        await session.flush()
