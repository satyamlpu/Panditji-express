"""In-app notifications (SRS NTF module).

Best-effort side signal — never the source of truth for booking status. A failed
notification must not affect a saved booking, so callers treat this as additive.
Push/SMS/email channels layer on top of the same records in a later phase.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.marketplace.constants import Principal
from app.marketplace.models import Notification


async def _push(
    session: AsyncSession,
    *,
    recipient_kind: str,
    recipient_id,
    kind: str,
    title: str,
    body: str | None = None,
    booking_id=None,
) -> None:
    session.add(
        Notification(
            recipient_kind=recipient_kind,
            recipient_id=recipient_id if isinstance(recipient_id, uuid.UUID)
            else uuid.UUID(str(recipient_id)),
            kind=kind,
            title=title,
            body=body,
            booking_id=booking_id,
        )
    )
    await session.flush()


async def notify_customer(
    session: AsyncSession, customer_id, *, kind, title, body=None, booking_id=None
) -> None:
    await _push(
        session, recipient_kind=Principal.CUSTOMER, recipient_id=customer_id,
        kind=kind, title=title, body=body, booking_id=booking_id,
    )


async def notify_pandit(
    session: AsyncSession, pandit_id, *, kind, title, body=None, booking_id=None
) -> None:
    await _push(
        session, recipient_kind=Principal.PANDIT, recipient_id=pandit_id,
        kind=kind, title=title, body=body, booking_id=booking_id,
    )
