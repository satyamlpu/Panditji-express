"""Public, unauthenticated read API + booking enquiry submission.

Only PUBLISHED content is ever returned here; drafts and unpublished items are
invisible to the public and absent from the sitemap.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip
from app.api.serializers import service_public
from app.core.config import settings
from app.core.constants import ContentStatus
from app.core.errors import APIError, NotFoundError
from app.core.ratelimit import rate_limit
from app.db.session import get_session
from app.models.banner import HomepageSection
from app.models.category import Category
from app.models.enquiry import BookingEnquiry
from app.models.faq import Faq
from app.models.location import Location, ServiceLocation
from app.models.page import Page
from app.models.redirect import Redirect
from app.models.service import Service
from app.models.setting import Setting
from app.models.testimonial import Testimonial
from app.schemas.common import MessageResponse
from app.schemas.enquiry import EnquiryCreate
from app.schemas.public import (
    CategoryDetailPublic,
    CategoryPublic,
    FaqGroup,
    FaqPublic,
    HomepageSectionPublic,
    LocationDetailPublic,
    LocationListItem,
    PagePublic,
    RedirectOut,
    SeoResolved,
    ServiceCardPublic,
    ServiceDetailPublic,
    SitemapEntry,
    TestimonialPublic,
)
from app.schemas.service import ServicePublicListItem
from app.services.money import paise_to_rupees, price_display

router = APIRouter(prefix="/api/v1/public", tags=["public"])

_PUBLISHED = ContentStatus.PUBLISHED


def _truncate(text: str | None, length: int) -> str | None:
    if not text:
        return None
    clean = " ".join(text.split())
    return clean if len(clean) <= length else clean[: length - 1].rstrip() + "…"


async def _category_ref(session: AsyncSession, service: Service):
    if service.category_id is None:
        return None
    cat = (
        await session.execute(
            select(Category).where(
                Category.id == service.category_id, Category.status == _PUBLISHED
            )
        )
    ).scalar_one_or_none()
    if cat is None:
        return None
    from app.api.serializers import category_ref

    return category_ref(cat)


def _service_card(service: Service) -> ServiceCardPublic:
    return ServiceCardPublic(
        slug=service.slug,
        title=service.title,
        summary=service.summary,
        price_display=price_display(service.price_paise),
        duration_label=service.duration_label,
    )


def _page_seo(
    *, seo_title: str | None, title: str, description: str | None, canonical: str
) -> SeoResolved:
    return SeoResolved(
        title=seo_title or title,
        description=description,
        og_title=seo_title or title,
        og_description=description,
        canonical_path=canonical,
    )


@router.get("/services", response_model=list[ServicePublicListItem])
async def public_services(
    session: AsyncSession = Depends(get_session),
    category: str | None = Query(default=None),
    featured: bool | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[ServicePublicListItem]:
    stmt = select(Service).where(Service.status == _PUBLISHED)
    if category:
        cat = (
            await session.execute(
                select(Category.id).where(
                    Category.slug == category, Category.status == _PUBLISHED
                )
            )
        ).scalar_one_or_none()
        stmt = stmt.where(Service.category_id == cat) if cat else stmt.where(False)
    if featured is not None:
        stmt = stmt.where(Service.is_featured == featured)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Service.title.ilike(like))
    stmt = stmt.order_by(Service.sort_order.asc(), Service.title.asc())

    services = (await session.execute(stmt)).scalars().all()
    out = []
    for s in services:
        out.append(service_public(s, None))
        # attach a published category ref if present
        out[-1].category = await _category_ref(session, s)
    return out


@router.get("/services/{slug}", response_model=ServiceDetailPublic)
async def public_service_detail(
    slug: str, session: AsyncSession = Depends(get_session)
) -> ServiceDetailPublic:
    service = (
        await session.execute(
            select(Service).where(Service.slug == slug, Service.status == _PUBLISHED)
        )
    ).scalar_one_or_none()
    if service is None:
        raise NotFoundError("Service not found")

    faqs = (
        await session.execute(
            select(Faq)
            .where(Faq.service_id == service.id, Faq.status == _PUBLISHED)
            .order_by(Faq.sort_order.asc())
        )
    ).scalars().all()

    seo = SeoResolved(
        # Clean title; the frontend appends the brand suffix via its template.
        title=service.seo_title or service.title,
        description=service.seo_description
        or _truncate(service.summary or service.description, 160),
        og_title=service.og_title or service.seo_title or service.title,
        og_description=service.og_description
        or service.seo_description
        or _truncate(service.summary or service.description, 200),
        canonical_path=f"/puja-services/{service.slug}",
    )

    return ServiceDetailPublic(
        slug=service.slug,
        title=service.title,
        summary=service.summary,
        description=service.description,
        price_rupees=paise_to_rupees(service.price_paise),
        price_display=price_display(service.price_paise),
        duration_label=service.duration_label,
        inclusions=service.inclusions or [],
        samagri=service.samagri or [],
        is_featured=service.is_featured,
        category=await _category_ref(session, service),
        faqs=[FaqPublic(question=f.question, answer=f.answer) for f in faqs],
        seo=seo,
    )


@router.get("/categories", response_model=list[CategoryPublic])
async def public_categories(
    session: AsyncSession = Depends(get_session),
) -> list[CategoryPublic]:
    cats = (
        await session.execute(
            select(Category)
            .where(Category.status == _PUBLISHED)
            .order_by(Category.sort_order.asc(), Category.name.asc())
        )
    ).scalars().all()
    out = []
    for c in cats:
        count = (
            await session.execute(
                select(func.count())
                .select_from(Service)
                .where(Service.category_id == c.id, Service.status == _PUBLISHED)
            )
        ).scalar_one()
        out.append(
            CategoryPublic(
                slug=c.slug, name=c.name, description=c.description, service_count=count
            )
        )
    return out


@router.post("/enquiries", response_model=MessageResponse, status_code=201)
async def submit_enquiry(
    payload: EnquiryCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    # Honeypot: real users never fill the hidden `website` field.
    if payload.website:
        return MessageResponse(message="Thank you. We'll be in touch shortly.")

    ip = client_ip(request)
    if not rate_limit(
        f"enquiry:{ip}", settings.rate_limit_enquiry_per_hour, window_seconds=3600
    ):
        raise APIError(
            "Too many enquiries from this device. Please try again later.",
            code="rate_limited",
            status_code=429,
        )

    service_title = None
    service_id = None
    if payload.service_slug:
        svc = (
            await session.execute(
                select(Service).where(
                    Service.slug == payload.service_slug, Service.status == _PUBLISHED
                )
            )
        ).scalar_one_or_none()
        if svc is not None:
            service_id = svc.id
            service_title = svc.title

    session.add(
        BookingEnquiry(
            service_id=service_id,
            service_title_snapshot=service_title,
            name=payload.name.strip(),
            phone=payload.phone.strip(),
            email=str(payload.email) if payload.email else None,
            city=payload.city.strip() if payload.city else None,
            preferred_date=payload.preferred_date,
            message=payload.message.strip() if payload.message else None,
        )
    )
    await session.flush()
    return MessageResponse(message="Thank you. We'll be in touch shortly.")


@router.get("/categories/{slug}", response_model=CategoryDetailPublic)
async def public_category_detail(
    slug: str, session: AsyncSession = Depends(get_session)
) -> CategoryDetailPublic:
    cat = (
        await session.execute(
            select(Category).where(Category.slug == slug, Category.status == _PUBLISHED)
        )
    ).scalar_one_or_none()
    if cat is None:
        raise NotFoundError("Category not found")

    services = (
        await session.execute(
            select(Service)
            .where(Service.category_id == cat.id, Service.status == _PUBLISHED)
            .order_by(Service.sort_order.asc(), Service.title.asc())
        )
    ).scalars().all()

    return CategoryDetailPublic(
        slug=cat.slug,
        name=cat.name,
        description=cat.description,
        services=[_service_card(s) for s in services],
        seo=_page_seo(
            seo_title=cat.seo_title,
            title=f"{cat.name} Pujas",
            description=cat.seo_description or _truncate(cat.description, 160),
            canonical=f"/puja-categories/{cat.slug}",
        ),
    )


@router.get("/locations", response_model=list[LocationListItem])
async def public_locations(
    session: AsyncSession = Depends(get_session),
) -> list[LocationListItem]:
    locations = (
        await session.execute(
            select(Location)
            .where(Location.status == _PUBLISHED)
            .order_by(Location.sort_order.asc(), Location.city.asc())
        )
    ).scalars().all()
    out = []
    for loc in locations:
        count = (
            await session.execute(
                select(func.count())
                .select_from(ServiceLocation)
                .join(Service, Service.id == ServiceLocation.service_id)
                .where(
                    ServiceLocation.location_id == loc.id,
                    Service.status == _PUBLISHED,
                )
            )
        ).scalar_one()
        out.append(
            LocationListItem(
                slug=loc.slug, city=loc.city, region=loc.region, service_count=count
            )
        )
    return out


@router.get("/locations/{slug}", response_model=LocationDetailPublic)
async def public_location_detail(
    slug: str, session: AsyncSession = Depends(get_session)
) -> LocationDetailPublic:
    loc = (
        await session.execute(
            select(Location).where(Location.slug == slug, Location.status == _PUBLISHED)
        )
    ).scalar_one_or_none()
    if loc is None:
        raise NotFoundError("Location not found")

    services = (
        await session.execute(
            select(Service)
            .join(ServiceLocation, ServiceLocation.service_id == Service.id)
            .where(
                ServiceLocation.location_id == loc.id,
                Service.status == _PUBLISHED,
            )
            .order_by(Service.sort_order.asc(), Service.title.asc())
        )
    ).scalars().all()

    return LocationDetailPublic(
        slug=loc.slug,
        city=loc.city,
        region=loc.region,
        description=loc.description,
        services=[_service_card(s) for s in services],
        seo=_page_seo(
            seo_title=loc.seo_title,
            title=f"Puja Services in {loc.city}",
            description=loc.seo_description
            or _truncate(loc.description, 160)
            or f"Book pandits for authentic pujas in {loc.city}.",
            canonical=f"/locations/{loc.slug}",
        ),
    )


@router.get("/homepage", response_model=list[HomepageSectionPublic])
async def public_homepage(
    session: AsyncSession = Depends(get_session),
) -> list[HomepageSectionPublic]:
    """Published homepage sections (hero, feature, cta, …), ordered."""
    rows = (
        await session.execute(
            select(HomepageSection)
            .where(HomepageSection.status == _PUBLISHED)
            .order_by(HomepageSection.sort_order.asc())
        )
    ).scalars().all()
    return [
        HomepageSectionPublic(
            kind=b.kind,
            heading=b.heading,
            subheading=b.subheading,
            body=b.body,
            cta_label=b.cta_label,
            cta_href=b.cta_href,
            image_url=b.image_url,
            sort_order=b.sort_order,
        )
        for b in rows
    ]


@router.get("/testimonials", response_model=list[TestimonialPublic])
async def public_testimonials(
    session: AsyncSession = Depends(get_session),
) -> list[TestimonialPublic]:
    rows = (
        await session.execute(
            select(Testimonial)
            .where(Testimonial.status == _PUBLISHED)
            .order_by(Testimonial.sort_order.asc(), Testimonial.created_at.desc())
        )
    ).scalars().all()
    return [
        TestimonialPublic(
            author_name=t.author_name,
            author_location=t.author_location,
            service_label=t.service_label,
            quote=t.quote,
            rating=t.rating,
        )
        for t in rows
    ]


@router.get("/faqs", response_model=list[FaqGroup])
async def public_faqs(session: AsyncSession = Depends(get_session)) -> list[FaqGroup]:
    """Global FAQs (not attached to a specific service), grouped by topic."""
    rows = (
        await session.execute(
            select(Faq)
            .where(Faq.service_id.is_(None), Faq.status == _PUBLISHED)
            .order_by(Faq.sort_order.asc())
        )
    ).scalars().all()
    groups: dict[str, list[FaqPublic]] = {}
    for f in rows:
        groups.setdefault(f.topic or "General", []).append(
            FaqPublic(question=f.question, answer=f.answer)
        )
    return [FaqGroup(topic=k, items=v) for k, v in groups.items()]


@router.get("/pages/{slug}", response_model=PagePublic)
async def public_page(
    slug: str, session: AsyncSession = Depends(get_session)
) -> PagePublic:
    page = (
        await session.execute(
            select(Page).where(Page.slug == slug, Page.status == _PUBLISHED)
        )
    ).scalar_one_or_none()
    if page is None:
        raise NotFoundError("Page not found")
    return PagePublic(
        slug=page.slug,
        title=page.title,
        body=page.body,
        seo=_page_seo(
            seo_title=page.seo_title,
            title=page.title,
            description=page.seo_description or _truncate(page.body, 160),
            canonical=f"/{page.slug}",
        ),
    )


_PUBLIC_SETTING_KEYS = (
    "site",
    "contact",
    "nav",
    "footer",
    "social",
    "seo_defaults",
)


@router.get("/settings")
async def public_settings(session: AsyncSession = Depends(get_session)) -> dict:
    """Site-wide settings the public layout needs (nav, footer, contact, SEO)."""
    rows = (
        await session.execute(
            select(Setting).where(Setting.key.in_(_PUBLIC_SETTING_KEYS))
        )
    ).scalars().all()
    return {row.key: row.value for row in rows}


@router.get("/sitemap", response_model=list[SitemapEntry])
async def sitemap_entries(
    session: AsyncSession = Depends(get_session),
) -> list[SitemapEntry]:
    """Published, canonical URLs for the frontend's sitemap.xml."""
    entries: list[SitemapEntry] = []

    services = (
        await session.execute(
            select(Service.slug, Service.updated_at).where(Service.status == _PUBLISHED)
        )
    ).all()
    for slug, updated in services:
        entries.append(SitemapEntry(path=f"/puja-services/{slug}", lastmod=updated))

    cats = (
        await session.execute(
            select(Category.slug, Category.updated_at).where(
                Category.status == _PUBLISHED
            )
        )
    ).all()
    for slug, updated in cats:
        entries.append(SitemapEntry(path=f"/puja-categories/{slug}", lastmod=updated))

    locs = (
        await session.execute(
            select(Location.slug, Location.updated_at).where(
                Location.status == _PUBLISHED
            )
        )
    ).all()
    for slug, updated in locs:
        entries.append(SitemapEntry(path=f"/locations/{slug}", lastmod=updated))

    return entries


@router.get("/redirects", response_model=RedirectOut | None)
async def resolve_redirect(
    path: str = Query(...), session: AsyncSession = Depends(get_session)
) -> RedirectOut | None:
    row = (
        await session.execute(select(Redirect).where(Redirect.from_path == path))
    ).scalar_one_or_none()
    if row is None:
        return None
    return RedirectOut(to_path=row.to_path, status_code=row.status_code)
