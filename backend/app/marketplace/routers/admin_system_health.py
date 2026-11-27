"""System Health (read-only ops panel).

A super-admin-only snapshot of platform liveness: a database round-trip, live
domain counters, and the non-sensitive configuration/provider posture (names and
booleans only — **never** secret values), plus honest config warnings (dev
defaults in use, SQLite in production, etc.). Additive and read-only.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin
from app.core.config import settings
from app.db.session import get_session
from app.marketplace.constants import Availability, BookingStatus, PanditStatus
from app.marketplace.models import (
    Booking,
    Customer,
    Pandit,
    Payment,
    Review,
    SupportTicket,
)
from app.marketplace.principals import require_staff
from app.marketplace.schemas import (
    SystemConfigOut,
    SystemCounters,
    SystemDatabase,
    SystemHealthOut,
)

router = APIRouter(prefix="/api/v1/mp/admin/system", tags=["mp:admin-system"])

_admin = Depends(require_staff())  # super-admin only


async def _count(session: AsyncSession, model, *conds) -> int:
    stmt = select(func.count()).select_from(model)
    for c in conds:
        stmt = stmt.where(c)
    return (await session.execute(stmt)).scalar_one()


def _dialect() -> str:
    url = settings.database_url.lower()
    if url.startswith("sqlite"):
        return "sqlite"
    if "postgres" in url:
        return "postgresql"
    return url.split(":", 1)[0]


def _config() -> SystemConfigOut:
    return SystemConfigOut(
        environment=settings.app_env,
        is_production=settings.is_production,
        geo_backend=settings.geo_backend,
        storage_backend=settings.storage_backend,
        media_storage_backend=settings.media_storage_backend,
        commission_percent=settings.platform_commission_percent,
        gateway_fee_percent=settings.gateway_fee_percent,
        cors_origins=len(settings.cors_origin_list),
        docs_enabled=not settings.is_production,
        supabase_kyc_configured=bool(settings.supabase_url and settings.supabase_service_key),
        supabase_media_configured=bool(settings.supabase_url and settings.media_public_base_url),
        revalidate_configured=bool(settings.frontend_revalidate_url and settings.revalidate_secret),
    )


def _warnings() -> list[str]:
    w: list[str] = []
    if settings.is_production and _dialect() == "sqlite":
        w.append("SQLite is in use in a production environment.")
    if settings.is_production and settings.storage_backend == "local":
        w.append("KYC storage is local in production — use Supabase private storage.")
    if settings.is_production and not bool(
        settings.frontend_revalidate_url and settings.revalidate_secret
    ):
        w.append("Public-site revalidation is not fully configured (CMS edits may lag).")
    return w


@router.get("/health", response_model=SystemHealthOut)
async def system_health(
    _: CurrentAdmin = _admin, session: AsyncSession = Depends(get_session)
) -> SystemHealthOut:
    # Database liveness round-trip.
    try:
        await session.execute(text("SELECT 1"))
        db = SystemDatabase(status="connected", dialect=_dialect())
    except Exception as exc:  # pragma: no cover - infra dependent
        db = SystemDatabase(status=f"error:{type(exc).__name__}", dialect=_dialect())

    counters = SystemCounters(
        customers=await _count(session, Customer),
        pandits_total=await _count(session, Pandit),
        pandits_approved=await _count(session, Pandit, Pandit.status == PanditStatus.APPROVED),
        pandits_online=await _count(session, Pandit, Pandit.availability == Availability.ONLINE),
        bookings_total=await _count(session, Booking),
        bookings_active=await _count(session, Booking, Booking.status.in_(BookingStatus.ASSIGNED)),
        bookings_dispatching=await _count(
            session, Booking, Booking.status.in_(BookingStatus.DISPATCHING)
        ),
        bookings_no_partner=await _count(
            session, Booking, Booking.status == BookingStatus.NO_PARTNER
        ),
        reviews=await _count(session, Review),
        open_tickets=await _count(
            session, SupportTicket, SupportTicket.status.notin_(("resolved", "closed"))
        ),
        payments=await _count(session, Payment),
    )

    warnings = _warnings()
    status = "ok" if db.status == "connected" and not warnings else "degraded"
    return SystemHealthOut(
        status=status,
        generated_at=datetime.now(UTC),
        database=db,
        counters=counters,
        config=_config(),
        warnings=warnings,
    )
