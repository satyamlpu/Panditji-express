"""Admin CRUD for services (pujas). All routes require an authenticated admin.

Saving published content triggers on-demand revalidation of the affected public
pages so edits appear without a redeploy.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.api.serializers import service_out
from app.core.constants import Audit, ContentStatus
from app.core.errors import ConflictError, NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.models.category import Category
from app.models.redirect import Redirect
from app.models.service import Service
from app.schemas.common import MessageResponse, Page
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate
from app.services.audit import audit
from app.services.money import rupees_to_paise
from app.services.revalidate import revalidate_tags

router = APIRouter(
    prefix="/api/v1/admin/services",
    tags=["admin:services"],
    dependencies=[Depends(require_admin)],
)


def _revalidate(bg: BackgroundTasks, *slugs: str) -> None:
    tags = ["services", "catalog"]
    tags += [f"service:{s}" for s in slugs if s]
    bg.add_task(revalidate_tags, tags)


async def _load(session: AsyncSession, service_id: str) -> Service:
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        raise NotFoundError("Service not found") from None
    service = (
        await session.execute(select(Service).where(Service.id == sid))
    ).scalar_one_or_none()
    if service is None:
        raise NotFoundError("Service not found")
    return service


async def _category_for(session: AsyncSession, service: Service) -> Category | None:
    if service.category_id is None:
        return None
    return (
        await session.execute(
            select(Category).where(Category.id == service.category_id)
        )
    ).scalar_one_or_none()


async def _slug_taken(session: AsyncSession, slug: str, exclude: uuid.UUID | None) -> bool:
    stmt = select(Service.id).where(Service.slug == slug)
    if exclude is not None:
        stmt = stmt.where(Service.id != exclude)
    return (await session.execute(stmt)).first() is not None


async def _resolve_category_id(session: AsyncSession, category_id: str | None):
    if not category_id:
        return None
    try:
        cid = uuid.UUID(category_id)
    except ValueError:
        raise NotFoundError("Category not found") from None
    exists = (
        await session.execute(select(Category.id).where(Category.id == cid))
    ).first()
    if not exists:
        raise NotFoundError("Category not found")
    return cid


@router.get("", response_model=Page[ServiceOut])
async def list_services(
    session: AsyncSession = Depends(get_session),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[ServiceOut]:
    stmt = select(Service)
    if status:
        stmt = stmt.where(Service.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Service.title.ilike(like), Service.slug.ilike(like)))

    total = (
        await session.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()

    stmt = (
        stmt.order_by(Service.sort_order.asc(), Service.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    services = (await session.execute(stmt)).scalars().all()

    items = []
    for s in services:
        items.append(service_out(s, await _category_for(session, s)))
    return Page[ServiceOut](items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ServiceOut, status_code=201)
async def create_service(
    payload: ServiceCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ServiceOut:
    if await _slug_taken(session, payload.slug, exclude=None):
        raise ConflictError(f"The slug '{payload.slug}' is already in use")

    category_id = await _resolve_category_id(session, payload.category_id)
    service = Service(
        slug=payload.slug,
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        price_paise=rupees_to_paise(payload.price_rupees),
        duration_label=payload.duration_label,
        inclusions=payload.inclusions,
        samagri=payload.samagri,
        category_id=category_id,
        is_featured=payload.is_featured,
        sort_order=payload.sort_order,
        status=payload.status,
        published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        og_title=payload.og_title,
        og_description=payload.og_description,
        canonical_url=payload.canonical_url,
    )
    session.add(service)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="service",
        entity_id=str(service.id),
        ip=client_ip(request),
        meta={"slug": service.slug, "status": service.status},
    )
    _revalidate(bg, service.slug)
    return service_out(service, await _category_for(session, service))


@router.get("/{service_id}", response_model=ServiceOut)
async def get_service(
    service_id: str, session: AsyncSession = Depends(get_session)
) -> ServiceOut:
    service = await _load(session, service_id)
    return service_out(service, await _category_for(session, service))


@router.patch("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: str,
    payload: ServiceUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ServiceOut:
    service = await _load(session, service_id)
    data = payload.model_dump(exclude_unset=True)
    old_slug = service.slug

    # Slug change → uniqueness check + 301 redirects from the old URLs.
    if "slug" in data and data["slug"] != service.slug:
        if await _slug_taken(session, data["slug"], exclude=service.id):
            raise ConflictError(f"The slug '{data['slug']}' is already in use")
        for prefix in ("/puja-services", "/book"):
            session.add(
                Redirect(
                    from_path=f"{prefix}/{old_slug}",
                    to_path=f"{prefix}/{data['slug']}",
                    status_code=301,
                )
            )
        await audit(
            session,
            action=Audit.SLUG_CHANGE,
            actor_id=admin.id,
            actor_email=admin.email,
            entity="service",
            entity_id=str(service.id),
            ip=client_ip(request),
            meta={"from": old_slug, "to": data["slug"]},
        )

    if "category_id" in data:
        service.category_id = await _resolve_category_id(session, data["category_id"])
    if "price_rupees" in data:
        service.price_paise = rupees_to_paise(data["price_rupees"])

    # Status transition maintains published_at.
    if "status" in data and data["status"] != service.status:
        if data["status"] == ContentStatus.PUBLISHED and service.published_at is None:
            service.published_at = utcnow()
        action = (
            Audit.PUBLISH
            if data["status"] == ContentStatus.PUBLISHED
            else Audit.UNPUBLISH
            if data["status"] == ContentStatus.UNPUBLISHED
            else Audit.UPDATE
        )
        await audit(
            session,
            action=action,
            actor_id=admin.id,
            actor_email=admin.email,
            entity="service",
            entity_id=str(service.id),
            ip=client_ip(request),
            meta={"status": data["status"]},
        )

    for field in (
        "slug",
        "title",
        "summary",
        "description",
        "duration_label",
        "inclusions",
        "samagri",
        "is_featured",
        "sort_order",
        "status",
        "seo_title",
        "seo_description",
        "og_title",
        "og_description",
        "canonical_url",
    ):
        if field in data:
            setattr(service, field, data[field])

    await session.flush()
    _revalidate(bg, service.slug, old_slug)
    return service_out(service, await _category_for(session, service))


@router.delete("/{service_id}", response_model=MessageResponse)
async def delete_service(
    service_id: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    service = await _load(session, service_id)
    slug = service.slug
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="service",
        entity_id=str(service.id),
        ip=client_ip(request),
        meta={"slug": slug},
    )
    await session.delete(service)
    await session.flush()
    _revalidate(bg, slug)
    return MessageResponse(message="Service deleted")
