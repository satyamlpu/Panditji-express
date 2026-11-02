"""Admin CRUD for puja categories."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, client_ip, require_admin
from app.api.serializers import category_out
from app.core.constants import Audit, ContentStatus
from app.core.errors import ConflictError, NotFoundError
from app.db.base import utcnow
from app.db.session import get_session
from app.models.category import Category
from app.models.service import Service
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.schemas.common import MessageResponse
from app.services.audit import audit
from app.services.revalidate import revalidate_tags

router = APIRouter(
    prefix="/api/v1/admin/categories",
    tags=["admin:categories"],
    dependencies=[Depends(require_admin)],
)


def _revalidate(bg: BackgroundTasks) -> None:
    bg.add_task(revalidate_tags, ["categories", "catalog"])


async def _load(session: AsyncSession, category_id: str) -> Category:
    try:
        cid = uuid.UUID(category_id)
    except ValueError:
        raise NotFoundError("Category not found") from None
    cat = (
        await session.execute(select(Category).where(Category.id == cid))
    ).scalar_one_or_none()
    if cat is None:
        raise NotFoundError("Category not found")
    return cat


async def _slug_taken(session: AsyncSession, slug: str, exclude: uuid.UUID | None) -> bool:
    stmt = select(Category.id).where(Category.slug == slug)
    if exclude is not None:
        stmt = stmt.where(Category.id != exclude)
    return (await session.execute(stmt)).first() is not None


async def _count_services(session: AsyncSession, cid: uuid.UUID) -> int:
    return (
        await session.execute(
            select(func.count()).select_from(Service).where(Service.category_id == cid)
        )
    ).scalar_one()


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    session: AsyncSession = Depends(get_session),
) -> list[CategoryOut]:
    cats = (
        await session.execute(
            select(Category).order_by(Category.sort_order.asc(), Category.name.asc())
        )
    ).scalars().all()
    return [category_out(c, await _count_services(session, c.id)) for c in cats]


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> CategoryOut:
    if await _slug_taken(session, payload.slug, exclude=None):
        raise ConflictError(f"The slug '{payload.slug}' is already in use")
    cat = Category(
        slug=payload.slug,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
        status=payload.status,
        published_at=utcnow() if payload.status == ContentStatus.PUBLISHED else None,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        og_title=payload.og_title,
        og_description=payload.og_description,
        canonical_url=payload.canonical_url,
    )
    session.add(cat)
    await session.flush()
    await audit(
        session,
        action=Audit.CREATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="category",
        entity_id=str(cat.id),
        ip=client_ip(request),
    )
    _revalidate(bg)
    return category_out(cat, 0)


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: str, session: AsyncSession = Depends(get_session)
) -> CategoryOut:
    cat = await _load(session, category_id)
    return category_out(cat, await _count_services(session, cat.id))


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> CategoryOut:
    cat = await _load(session, category_id)
    data = payload.model_dump(exclude_unset=True)

    if (
        "slug" in data
        and data["slug"] != cat.slug
        and await _slug_taken(session, data["slug"], exclude=cat.id)
    ):
        raise ConflictError(f"The slug '{data['slug']}' is already in use")

    if (
        "status" in data
        and data["status"] == ContentStatus.PUBLISHED
        and cat.published_at is None
    ):
        cat.published_at = utcnow()

    for field in (
        "slug",
        "name",
        "description",
        "sort_order",
        "status",
        "seo_title",
        "seo_description",
        "og_title",
        "og_description",
        "canonical_url",
    ):
        if field in data:
            setattr(cat, field, data[field])

    await session.flush()
    await audit(
        session,
        action=Audit.UPDATE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="category",
        entity_id=str(cat.id),
        ip=client_ip(request),
    )
    _revalidate(bg)
    return category_out(cat, await _count_services(session, cat.id))


@router.delete("/{category_id}", response_model=MessageResponse)
async def delete_category(
    category_id: str,
    request: Request,
    bg: BackgroundTasks,
    admin: CurrentAdmin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    cat = await _load(session, category_id)
    await audit(
        session,
        action=Audit.DELETE,
        actor_id=admin.id,
        actor_email=admin.email,
        entity="category",
        entity_id=str(cat.id),
        ip=client_ip(request),
    )
    await session.delete(cat)
    await session.flush()
    _revalidate(bg)
    return MessageResponse(message="Category deleted")
