"""Admin finance (payments, ledger, refunds, payouts) and review moderation.

Finance actions are gated to the finance role (+ super-admin) and audited; a
refund requires a reason. Review moderation is gated to support (+ super-admin).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.errors import APIError, NotFoundError
from app.db.session import get_session
from app.marketplace import finance
from app.marketplace.constants import StaffRole
from app.marketplace.models import (
    Booking,
    Customer,
    LedgerEntry,
    Pandit,
    Payment,
    Review,
)
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    FinanceSummaryOut,
    LedgerEntryOut,
    PaymentOut,
    PayoutDue,
    PayoutRequest,
    RefundRequest,
    ReviewModerate,
    ReviewOut,
)
from app.marketplace.serialize import price_display
from app.services.audit import audit

router = APIRouter(prefix="/api/v1/mp/admin", tags=["mp:admin-finance"])

_finance = Depends(require_staff(StaffRole.FINANCE))
_support = Depends(require_staff(StaffRole.SUPPORT))


async def _payment_out(session: AsyncSession, p: Payment) -> PaymentOut:
    b = (
        await session.execute(select(Booking).where(Booking.id == p.booking_id))
    ).scalar_one_or_none()
    return PaymentOut(
        id=str(p.id),
        booking_code=b.code if b else "—",
        amount_paise=p.amount_paise,
        amount_display=price_display(p.amount_paise),
        status=p.status,
        provider_order_id=p.provider_order_id,
        provider_payment_id=p.provider_payment_id,
        refunded_paise=p.refunded_paise,
        paid_at=p.paid_at,
        created_at=p.created_at,
    )


@router.get("/finance/summary", response_model=FinanceSummaryOut)
async def finance_summary(
    _: CurrentAdmin = _finance, session: AsyncSession = Depends(get_session)
) -> FinanceSummaryOut:
    return FinanceSummaryOut(**await finance.summary(session))


@router.get("/finance/payments", response_model=list[PaymentOut])
async def payments(
    _: CurrentAdmin = _finance, session: AsyncSession = Depends(get_session)
) -> list[PaymentOut]:
    rows = (
        (await session.execute(select(Payment).order_by(Payment.created_at.desc()).limit(200)))
        .scalars()
        .all()
    )
    return [await _payment_out(session, p) for p in rows]


@router.get("/finance/payments/{pid}/ledger", response_model=list[LedgerEntryOut])
async def payment_ledger(
    pid: str, _: CurrentAdmin = _finance, session: AsyncSession = Depends(get_session)
) -> list[LedgerEntryOut]:
    try:
        p = (
            await session.execute(select(Payment).where(Payment.id == uuid.UUID(pid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Payment not found") from None
    if p is None:
        raise NotFoundError("Payment not found")
    rows = (
        (
            await session.execute(
                select(LedgerEntry)
                .where(LedgerEntry.booking_id == p.booking_id)
                .order_by(LedgerEntry.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return [
        LedgerEntryOut(
            entry_type=e.entry_type,
            amount_paise=e.amount_paise,
            amount_display=price_display(e.amount_paise),
            created_at=e.created_at,
        )
        for e in rows
    ]


@router.post("/finance/payments/{pid}/refund", response_model=PaymentOut)
async def refund(
    pid: str,
    payload: RefundRequest,
    admin: CurrentAdmin = _finance,
    session: AsyncSession = Depends(get_session),
) -> PaymentOut:
    if not payload.reason or len(payload.reason.strip()) < 2:
        raise APIError(
            "A reason is required for a refund.", code="reason_required", status_code=422
        )
    try:
        p = (
            await session.execute(select(Payment).where(Payment.id == uuid.UUID(pid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Payment not found") from None
    if p is None:
        raise NotFoundError("Payment not found")
    await finance.create_refund(
        session, p, amount_paise=payload.amount_paise, reason=payload.reason, actor=admin.email
    )
    return await _payment_out(session, p)


@router.get("/finance/payouts", response_model=list[PayoutDue])
async def payouts_due(
    _: CurrentAdmin = _finance, session: AsyncSession = Depends(get_session)
) -> list[PayoutDue]:
    rows = await finance.outstanding_by_pandit(session)
    out = []
    for r in rows:
        p = (
            await session.execute(select(Pandit).where(Pandit.id == uuid.UUID(r["pandit_id"])))
        ).scalar_one_or_none()
        out.append(
            PayoutDue(
                pandit_id=r["pandit_id"],
                pandit_name=p.name if p else None,
                amount_paise=r["amount_paise"],
                amount_display=price_display(r["amount_paise"]),
                bookings=r["bookings"],
            )
        )
    return out


@router.post("/finance/payouts")
async def process_payout(
    payload: PayoutRequest,
    admin: CurrentAdmin = _finance,
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        pid = uuid.UUID(payload.pandit_id)
    except ValueError:
        raise NotFoundError("Partner not found") from None
    payout = await finance.process_payout(session, pid, actor=admin.email)
    return {
        "ok": True,
        "amount_paise": payout.amount_paise,
        "amount_display": price_display(payout.amount_paise),
        "bookings": payout.bookings_count,
    }


# ── Reviews moderation ───────────────────────────────────────────────────────
async def _review_out(session: AsyncSession, r: Review) -> ReviewOut:
    b = (
        await session.execute(select(Booking).where(Booking.id == r.booking_id))
    ).scalar_one_or_none()
    c = (
        await session.execute(select(Customer).where(Customer.id == r.customer_id))
    ).scalar_one_or_none()
    p = (await session.execute(select(Pandit).where(Pandit.id == r.pandit_id))).scalar_one_or_none()
    return ReviewOut(
        id=str(r.id),
        booking_code=b.code if b else "—",
        rating=r.rating,
        comment=r.comment,
        customer_name=c.name if c else None,
        pandit_name=p.name if p else None,
        reported=r.reported,
        hidden=r.hidden,
        created_at=r.created_at,
    )


@router.get("/reviews", response_model=list[ReviewOut])
async def list_reviews(
    _: CurrentAdmin = _support, session: AsyncSession = Depends(get_session)
) -> list[ReviewOut]:
    rows = (
        (await session.execute(select(Review).order_by(Review.created_at.desc()).limit(200)))
        .scalars()
        .all()
    )
    return [await _review_out(session, r) for r in rows]


@router.post("/reviews/{rid}/moderate", response_model=ReviewOut)
async def moderate_review(
    rid: str,
    payload: ReviewModerate,
    request: Request,
    admin: CurrentAdmin = _support,
    session: AsyncSession = Depends(get_session),
) -> ReviewOut:
    try:
        r = (
            await session.execute(select(Review).where(Review.id == uuid.UUID(rid)))
        ).scalar_one_or_none()
    except ValueError:
        raise NotFoundError("Review not found") from None
    if r is None:
        raise NotFoundError("Review not found")
    r.hidden = payload.hidden
    await session.flush()
    await audit(
        session,
        action="mp.review.moderate",
        actor_id=admin.id,
        actor_email=admin.email,
        entity="review",
        entity_id=str(r.id),
        meta={"hidden": payload.hidden},
    )
    return await _review_out(session, r)
