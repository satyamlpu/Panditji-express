"""Payments, ledger, refunds and payouts (SRS PRC/PAY modules).

A mock gateway stands in for a real provider in dev, but the trust boundary is
the same as production: a payment is only ``paid`` after a **signed webhook** is
verified server-side and recorded idempotently — a client success screen never
confirms payment. Money is integer paise; the ledger is append-only.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import APIError, ConflictError, NotFoundError
from app.db.base import utcnow
from app.marketplace.constants import (
    LedgerType,
    MpAudit,
    PaymentStatus,
    PayoutStatus,
    RefundStatus,
)
from app.marketplace.models import (
    Booking,
    LedgerEntry,
    Payment,
    Payout,
    Refund,
)
from app.marketplace.notify import notify_customer, notify_pandit
from app.services.audit import audit


def commission_split(amount_paise: int) -> tuple[int, int, int]:
    """Return (gateway_fee, platform_commission, partner_payable) in paise."""
    gateway_fee = round(amount_paise * settings.gateway_fee_percent / 100)
    commission = round(amount_paise * settings.platform_commission_percent / 100)
    partner_payable = amount_paise - gateway_fee - commission
    return gateway_fee, commission, partner_payable


def sign_payload(body: bytes) -> str:
    return hmac.new(settings.payment_webhook_secret.encode(), body, hashlib.sha256).hexdigest()


def verify_signature(body: bytes, signature: str | None) -> bool:
    if not signature:
        return False
    return hmac.compare_digest(sign_payload(body), signature)


async def create_order(session: AsyncSession, booking: Booking) -> Payment:
    if booking.price_paise is None:
        raise APIError(
            "This booking has no fixed price to charge.",
            code="no_price",
            status_code=409,
        )
    existing = (
        (
            await session.execute(
                select(Payment).where(
                    Payment.booking_id == booking.id,
                    Payment.status.in_((PaymentStatus.CREATED, PaymentStatus.PAID)),
                )
            )
        )
        .scalars()
        .first()
    )
    if existing is not None:
        return existing  # idempotent: reuse an open/paid order
    payment = Payment(
        booking_id=booking.id,
        amount_paise=booking.price_paise,
        status=PaymentStatus.CREATED,
        provider_order_id="order_" + secrets.token_hex(10),
    )
    session.add(payment)
    await session.flush()
    await audit(
        session,
        action=MpAudit.PAYMENT_ORDER,
        entity="payment",
        entity_id=str(payment.id),
        meta={"booking": str(booking.id)},
    )
    return payment


async def record_paid(
    session: AsyncSession, provider_order_id: str, provider_payment_id: str
) -> Payment:
    """Mark an order paid and post the ledger — idempotent on provider_payment_id."""
    # Duplicate / out-of-order webhook → no-op.
    dup = (
        (
            await session.execute(
                select(Payment).where(Payment.provider_payment_id == provider_payment_id)
            )
        )
        .scalars()
        .first()
    )
    if dup is not None:
        return dup

    # Lock the order row: a concurrent duplicate webhook blocks here, then
    # re-reads status == PAID below and no-ops — so the ledger is posted once.
    payment = (
        (
            await session.execute(
                select(Payment)
                .where(Payment.provider_order_id == provider_order_id)
                .with_for_update()
            )
        )
        .scalars()
        .first()
    )
    if payment is None:
        raise NotFoundError("Unknown payment order")
    if payment.status == PaymentStatus.PAID:
        return payment

    booking = (
        await session.execute(select(Booking).where(Booking.id == payment.booking_id))
    ).scalar_one()

    payment.status = PaymentStatus.PAID
    payment.provider_payment_id = provider_payment_id
    payment.paid_at = utcnow()

    gateway_fee, commission, partner_payable = commission_split(payment.amount_paise)
    pandit_id = booking.assigned_pandit_id
    session.add_all(
        [
            LedgerEntry(
                booking_id=booking.id,
                payment_id=payment.id,
                entry_type=LedgerType.CUSTOMER_CHARGE,
                amount_paise=payment.amount_paise,
            ),
            LedgerEntry(
                booking_id=booking.id,
                payment_id=payment.id,
                entry_type=LedgerType.GATEWAY_FEE,
                amount_paise=gateway_fee,
            ),
            LedgerEntry(
                booking_id=booking.id,
                payment_id=payment.id,
                entry_type=LedgerType.PLATFORM_COMMISSION,
                amount_paise=commission,
            ),
            LedgerEntry(
                booking_id=booking.id,
                payment_id=payment.id,
                pandit_id=pandit_id,
                entry_type=LedgerType.PARTNER_PAYABLE,
                amount_paise=partner_payable,
            ),
        ]
    )
    await session.flush()
    await audit(
        session,
        action=MpAudit.PAYMENT_VERIFIED,
        entity="payment",
        entity_id=str(payment.id),
        meta={"amount_paise": payment.amount_paise},
    )
    await notify_customer(
        session,
        booking.customer_id,
        kind="payment",
        title="Payment received",
        body=f"Payment for {booking.code} is confirmed.",
        booking_id=booking.id,
    )
    return payment


async def create_refund(
    session: AsyncSession,
    payment: Payment,
    *,
    amount_paise: int | None,
    reason: str | None,
    actor: str,
    actor_id: str | None = None,
    ip: str | None = None,
) -> Refund:
    # Lock the payment row AND refresh its attributes, so concurrent refunds
    # can't each read the same remaining balance and together exceed the amount
    # paid (over-refund). A plain re-select would return the caller's already
    # loaded, now-stale instance; refresh re-reads under the lock.
    await session.refresh(payment, with_for_update=True)
    if payment.status not in (PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED):
        raise ConflictError("Only a paid payment can be refunded")
    remaining = payment.amount_paise - payment.refunded_paise
    amount = remaining if amount_paise is None else amount_paise
    if amount <= 0 or amount > remaining:
        raise APIError(
            f"Refund must be between 1 and {remaining} paise.",
            code="invalid_amount",
            status_code=422,
        )

    refund = Refund(
        payment_id=payment.id,
        amount_paise=amount,
        status=RefundStatus.PROCESSED,
        reason=reason,
        provider_refund_id="rfnd_" + secrets.token_hex(10),
        created_by=actor,
    )
    session.add(refund)
    payment.refunded_paise += amount
    payment.status = (
        PaymentStatus.REFUNDED
        if payment.refunded_paise >= payment.amount_paise
        else PaymentStatus.PARTIALLY_REFUNDED
    )
    session.add(
        LedgerEntry(
            booking_id=payment.booking_id,
            payment_id=payment.id,
            entry_type=LedgerType.REFUND,
            amount_paise=amount,
        )
    )
    await session.flush()
    booking = (
        await session.execute(select(Booking).where(Booking.id == payment.booking_id))
    ).scalar_one_or_none()
    await audit(
        session,
        action=MpAudit.REFUND,
        actor_id=actor_id,
        actor_email=actor,
        entity="payment",
        entity_id=str(payment.id),
        ip=ip,
        meta={"amount_paise": amount, "reason": reason},
    )
    if booking:
        await notify_customer(
            session,
            booking.customer_id,
            kind="refund",
            title="Refund processed",
            body=f"A refund of ₹{amount // 100} was issued.",
            booking_id=booking.id,
        )
    return refund


async def outstanding_by_pandit(session: AsyncSession) -> list[dict]:
    """Unsettled partner-payable, grouped by pandit."""
    rows = (
        await session.execute(
            select(
                LedgerEntry.pandit_id,
                func.sum(LedgerEntry.amount_paise),
                func.count(),
            )
            .where(
                LedgerEntry.entry_type == LedgerType.PARTNER_PAYABLE,
                LedgerEntry.settled.is_(False),
                LedgerEntry.pandit_id.is_not(None),
            )
            .group_by(LedgerEntry.pandit_id)
        )
    ).all()
    return [{"pandit_id": str(pid), "amount_paise": amt, "bookings": n} for pid, amt, n in rows]


async def process_payout(
    session: AsyncSession,
    pandit_id,
    *,
    actor: str,
    actor_id: str | None = None,
    ip: str | None = None,
) -> Payout:
    # Lock the unsettled payable rows so two concurrent payouts for the same
    # partner can't both read them and pay out twice; the loser sees no unsettled
    # rows after the winner commits and gets a clean "nothing due".
    entries = (
        (
            await session.execute(
                select(LedgerEntry)
                .where(
                    LedgerEntry.entry_type == LedgerType.PARTNER_PAYABLE,
                    LedgerEntry.settled.is_(False),
                    LedgerEntry.pandit_id == pandit_id,
                )
                .with_for_update()
            )
        )
        .scalars()
        .all()
    )
    if not entries:
        raise APIError("Nothing outstanding to pay out.", code="nothing_due", status_code=409)

    total = sum(e.amount_paise for e in entries)
    payout = Payout(
        pandit_id=pandit_id,
        amount_paise=total,
        bookings_count=len(entries),
        status=PayoutStatus.PAID,
        created_by=actor,
    )
    session.add(payout)
    await session.flush()
    for e in entries:
        e.settled = True
        e.payout_id = payout.id
    session.add(
        LedgerEntry(
            pandit_id=pandit_id, entry_type=LedgerType.PAYOUT, amount_paise=total, settled=True
        )
    )
    await session.flush()
    await audit(
        session,
        action=MpAudit.PAYOUT,
        actor_id=actor_id,
        actor_email=actor,
        entity="payout",
        entity_id=str(payout.id),
        ip=ip,
        meta={"pandit_id": str(pandit_id), "amount_paise": total},
    )
    await notify_pandit(
        session,
        pandit_id,
        kind="payout",
        title="Payout processed",
        body=f"₹{total // 100} has been paid out to you.",
    )
    return payout


async def summary(session: AsyncSession) -> dict:
    async def _sum(entry_type: str) -> int:
        return (
            await session.execute(
                select(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).where(
                    LedgerEntry.entry_type == entry_type
                )
            )
        ).scalar_one()

    gbv = await _sum(LedgerType.CUSTOMER_CHARGE)
    commission = await _sum(LedgerType.PLATFORM_COMMISSION)
    gateway = await _sum(LedgerType.GATEWAY_FEE)
    payable = await _sum(LedgerType.PARTNER_PAYABLE)
    refunds = await _sum(LedgerType.REFUND)
    paid_out = await _sum(LedgerType.PAYOUT)
    return {
        "gross_booking_value_paise": gbv,
        "platform_commission_paise": commission,
        "gateway_fees_paise": gateway,
        "partner_payable_paise": payable,
        "refunds_paise": refunds,
        "paid_out_paise": paid_out,
        "outstanding_payable_paise": payable - paid_out,
    }
