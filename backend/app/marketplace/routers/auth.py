"""Phone + OTP authentication for customers and pandits."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import APIError, UnauthorizedError
from app.core.ratelimit import rate_limit
from app.db.session import get_session
from app.marketplace.constants import MpAudit, PanditStatus, Principal
from app.marketplace.models import Customer, Pandit
from app.marketplace.otp import issue_otp, verify_otp
from app.marketplace.principals import client_ip, create_principal_token
from app.marketplace.schemas import OtpRequest, OtpRequestOut, OtpVerify, TokenOut
from app.services.audit import audit

router = APIRouter(prefix="/api/v1/mp/auth", tags=["mp:auth"])


@router.post("/otp/request", response_model=OtpRequestOut)
async def otp_request(
    payload: OtpRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> OtpRequestOut:
    ip = client_ip(request)
    if not await rate_limit(f"mp_otp:{ip}:{payload.phone}", 5, window_seconds=600):
        raise APIError(
            "Too many OTP requests. Please wait a few minutes.",
            code="rate_limited",
            status_code=429,
        )
    code = await issue_otp(session, payload.phone.strip(), payload.kind)
    await audit(
        session,
        action=MpAudit.OTP_REQUEST,
        entity=payload.kind,
        entity_id=payload.phone,
        ip=ip,
    )
    # In production the code is sent by SMS and never returned.
    return OtpRequestOut(
        message="OTP sent.",
        dev_code=None if settings.is_production else code,
    )


@router.post("/otp/verify", response_model=TokenOut)
async def otp_verify(
    payload: OtpVerify,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenOut:
    phone = payload.phone.strip()
    ok = await verify_otp(session, phone, payload.kind, payload.code.strip())
    if not ok:
        raise UnauthorizedError("Invalid or expired OTP")

    if payload.kind == Principal.CUSTOMER:
        row = (
            await session.execute(select(Customer).where(Customer.phone == phone))
        ).scalar_one_or_none()
        if row is None:
            row = Customer(phone=phone, name=payload.name)
            session.add(row)
            await session.flush()
        elif payload.name and not row.name:
            row.name = payload.name
    else:  # pandit
        row = (
            await session.execute(select(Pandit).where(Pandit.phone == phone))
        ).scalar_one_or_none()
        if row is None:
            row = Pandit(phone=phone, name=payload.name, status=PanditStatus.DRAFT)
            session.add(row)
            await session.flush()
        elif payload.name and not row.name:
            row.name = payload.name

    await audit(
        session,
        action=MpAudit.LOGIN,
        actor_id=str(row.id),
        entity=payload.kind,
        entity_id=phone,
        ip=client_ip(request),
    )
    token = create_principal_token(str(row.id), payload.kind)
    return TokenOut(access_token=token, kind=payload.kind, id=str(row.id))
