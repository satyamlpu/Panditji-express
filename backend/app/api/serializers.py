"""Model → schema conversion helpers, kept in one place so admin and public
routers present consistent shapes."""

from __future__ import annotations

from app.models.category import Category
from app.models.enquiry import BookingEnquiry
from app.models.service import Service
from app.schemas.category import CategoryOut
from app.schemas.enquiry import EnquiryOut
from app.schemas.service import (
    CategoryRef,
    ServiceOut,
    ServicePublicListItem,
)
from app.services.money import paise_to_rupees, price_display


def category_ref(category: Category | None) -> CategoryRef | None:
    if category is None:
        return None
    return CategoryRef(id=str(category.id), slug=category.slug, name=category.name)


def service_out(service: Service, category: Category | None) -> ServiceOut:
    return ServiceOut(
        id=str(service.id),
        slug=service.slug,
        title=service.title,
        summary=service.summary,
        description=service.description,
        price_rupees=paise_to_rupees(service.price_paise),
        price_display=price_display(service.price_paise),
        duration_label=service.duration_label,
        inclusions=service.inclusions or [],
        samagri=service.samagri or [],
        category=category_ref(category),
        is_featured=service.is_featured,
        sort_order=service.sort_order,
        status=service.status,
        published_at=service.published_at,
        seo_title=service.seo_title,
        seo_description=service.seo_description,
        og_title=service.og_title,
        og_description=service.og_description,
        canonical_url=service.canonical_url,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


def service_public(service: Service, category: Category | None) -> ServicePublicListItem:
    return ServicePublicListItem(
        slug=service.slug,
        title=service.title,
        summary=service.summary,
        price_rupees=paise_to_rupees(service.price_paise),
        price_display=price_display(service.price_paise),
        duration_label=service.duration_label,
        category=category_ref(category),
        is_featured=service.is_featured,
    )


def category_out(category: Category, service_count: int | None = None) -> CategoryOut:
    return CategoryOut(
        id=str(category.id),
        slug=category.slug,
        name=category.name,
        description=category.description,
        sort_order=category.sort_order,
        status=category.status,
        published_at=category.published_at,
        seo_title=category.seo_title,
        seo_description=category.seo_description,
        og_title=category.og_title,
        og_description=category.og_description,
        canonical_url=category.canonical_url,
        service_count=service_count,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


def enquiry_out(enquiry: BookingEnquiry) -> EnquiryOut:
    return EnquiryOut(
        id=str(enquiry.id),
        service_title_snapshot=enquiry.service_title_snapshot,
        name=enquiry.name,
        phone=enquiry.phone,
        email=enquiry.email,
        city=enquiry.city,
        preferred_date=enquiry.preferred_date,
        message=enquiry.message,
        status=enquiry.status,
        admin_notes=enquiry.admin_notes,
        created_at=enquiry.created_at,
    )
