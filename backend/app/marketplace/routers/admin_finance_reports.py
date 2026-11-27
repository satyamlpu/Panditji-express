"""Finance reporting & reconciliation (read-only).

Additive, finance-gated reporting on top of the existing append-only ledger —
it reads, it never moves money. Three windows the base Finance page lacks:
a reconciliation summary with a per-day breakdown, a filterable ledger feed
(drill-down), and the refund history. The refund *execution* and payout controls
stay on the existing Finance page (money mutations are approval-gated there).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.db.session import get_session
from app.marketplace.constants import LedgerType, StaffRole
from app.marketplace.models import Booking, LedgerEntry, Payment, Refund
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    FinanceDayRow,
    LedgerFeedOut,
    LedgerFeedRow,
    ReconciliationOut,
    ReconciliationTotals,
    RefundRow,
)
from app.services.money import price_display

router = APIRouter(prefix="/api/v1/mp/admin/finance", tags=["mp:admin-finance-reports"])

_finance = Depends(require_staff(StaffRole.FINANCE))


def _totals(by_type: dict[str, int]) -> ReconciliationTotals:
    gross = by_type.get(LedgerType.CUSTOMER_CHARGE, 0)
    commission = by_type.get(LedgerType.PLATFORM_COMMISSION, 0)
    gateway = by_type.get(LedgerType.GATEWAY_FEE, 0)
    payable = by_type.get(LedgerType.PARTNER_PAYABLE, 0)
    refunds = by_type.get(LedgerType.REFUND, 0)
    payouts = by_type.get(LedgerType.PAYOUT, 0)
    net_platform = commission - gateway
    outstanding = payable - payouts
    return ReconciliationTotals(
        gross_booking_value_paise=gross,
        gross_booking_value_display=price_display(gross),
        platform_commission_paise=commission,
        platform_commission_display=price_display(commission),
        gateway_fees_paise=gateway,
        gateway_fees_display=price_display(gateway),
        partner_payable_paise=payable,
        partner_payable_display=price_display(payable),
        refunds_paise=refunds,
        refunds_display=price_display(refunds),
        payouts_paise=payouts,
        payouts_display=price_display(payouts),
        net_platform_revenue_paise=net_platform,
        net_platform_revenue_display=price_display(net_platform),
        outstanding_payable_paise=outstanding,
        outstanding_payable_display=price_display(outstanding),
    )


@router.get("/reconciliation", response_model=ReconciliationOut)
async def reconciliation(
    _: CurrentAdmin = _finance,
    session: AsyncSession = Depends(get_session),
    days: int = Query(default=30, ge=1, le=365),
) -> ReconciliationOut:
    since = datetime.now(UTC) - timedelta(days=days)

    # Overall totals in-range, grouped by ledger entry type.
    type_rows = (
        await session.execute(
            select(LedgerEntry.entry_type, func.coalesce(func.sum(LedgerEntry.amount_paise), 0))
            .where(LedgerEntry.created_at >= since)
            .group_by(LedgerEntry.entry_type)
        )
    ).all()
    by_type = {t: int(amt) for t, amt in type_rows}

    # Per-day × type breakdown.
    day_rows = (
        await session.execute(
            select(
                func.date(LedgerEntry.created_at),
                LedgerEntry.entry_type,
                func.coalesce(func.sum(LedgerEntry.amount_paise), 0),
            )
            .where(LedgerEntry.created_at >= since)
            .group_by(func.date(LedgerEntry.created_at), LedgerEntry.entry_type)
        )
    ).all()
    per_day: dict[str, dict[str, int]] = {}
    for day, etype, amt in day_rows:
        per_day.setdefault(str(day), {})[etype] = int(amt)

    by_day = [
        FinanceDayRow(
            date=day,
            charges_paise=d.get(LedgerType.CUSTOMER_CHARGE, 0),
            commission_paise=d.get(LedgerType.PLATFORM_COMMISSION, 0),
            gateway_paise=d.get(LedgerType.GATEWAY_FEE, 0),
            payable_paise=d.get(LedgerType.PARTNER_PAYABLE, 0),
            refunds_paise=d.get(LedgerType.REFUND, 0),
            payouts_paise=d.get(LedgerType.PAYOUT, 0),
        )
        for day, d in sorted(per_day.items(), reverse=True)
    ]
    return ReconciliationOut(range_days=days, totals=_totals(by_type), by_day=by_day)


@router.get("/ledger", response_model=LedgerFeedOut)
async def ledger_feed(
    _: CurrentAdmin = _finance,
    session: AsyncSession = Depends(get_session),
    entry_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> LedgerFeedOut:
    count_stmt = select(func.count()).select_from(LedgerEntry)
    rows_stmt: Select = (
        select(LedgerEntry, Booking.code)
        .outerjoin(Booking, Booking.id == LedgerEntry.booking_id)
    )
    if entry_type:
        count_stmt = count_stmt.where(LedgerEntry.entry_type == entry_type)
        rows_stmt = rows_stmt.where(LedgerEntry.entry_type == entry_type)

    total = (await session.execute(count_stmt)).scalar_one()
    rows = (
        await session.execute(
            rows_stmt.order_by(LedgerEntry.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return LedgerFeedOut(
        items=[
            LedgerFeedRow(
                id=str(e.id), entry_type=e.entry_type, amount_paise=e.amount_paise,
                amount_display=price_display(e.amount_paise), booking_code=code,
                pandit_id=str(e.pandit_id) if e.pandit_id else None,
                settled=e.settled, created_at=e.created_at,
            )
            for e, code in rows
        ],
        total=total, page=page, page_size=page_size,
    )


@router.get("/refunds", response_model=list[RefundRow])
async def refunds(
    _: CurrentAdmin = _finance, session: AsyncSession = Depends(get_session)
) -> list[RefundRow]:
    rows = (
        await session.execute(
            select(Refund, Booking.code)
            .join(Payment, Payment.id == Refund.payment_id)
            .outerjoin(Booking, Booking.id == Payment.booking_id)
            .order_by(Refund.created_at.desc())
            .limit(200)
        )
    ).all()
    return [
        RefundRow(
            id=str(r.id), booking_code=code, amount_paise=r.amount_paise,
            amount_display=price_display(r.amount_paise), reason=r.reason,
            status=r.status, created_by=r.created_by, created_at=r.created_at,
        )
        for r, code in rows
    ]
