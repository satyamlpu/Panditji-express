"""Seed the database with an admin account and clearly-labelled PLACEHOLDER
content so the site is demonstrable end-to-end.

IMPORTANT: every service, price, testimonial and policy below is sample data,
not verified business information. Replace or remove it through the admin panel
before any real launch (`python seed.py --wipe-content` clears placeholder
content but keeps the admin account).

Run after `alembic upgrade head`:

    python seed.py              # create admin + placeholder content (idempotent)
    python seed.py --wipe-content   # delete placeholder content only
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.constants import AdminStatus, ContentStatus, Role
from app.core.security import hash_password
from app.db.base import utcnow
from app.db.session import async_session_maker
from app.models.admin_user import AdminUser
from app.models.banner import HomepageSection
from app.models.category import Category
from app.models.faq import Faq
from app.models.location import Location, ServiceLocation
from app.models.page import Page
from app.models.service import Service
from app.models.setting import Setting
from app.models.testimonial import Testimonial

PUB = ContentStatus.PUBLISHED


def _rupees(n: int) -> int:
    return n * 100


SETTINGS = {
    "site": {
        "name": "Pandit Ji Express",
        "tagline": "Book an experienced pandit for authentic pujas — at home, on time.",
        "sample_data": True,
    },
    "contact": {
        "phone": "+91 00000 00000",
        "whatsapp": "+91 00000 00000",
        "email": "hello@panditjiexpress.in",
        "hours": "Mon–Sun, 7am–9pm",
        "note": "PLACEHOLDER contact details — replace in admin → Settings.",
    },
    "nav": [
        {"label": "Pujas", "href": "/puja-services"},
        {"label": "Locations", "href": "/locations"},
        {"label": "How it works", "href": "/how-it-works"},
        {"label": "About", "href": "/about-us"},
        {"label": "Contact", "href": "/contact-us"},
    ],
    "footer": {
        "columns": [
            {
                "title": "Services",
                "links": [
                    {"label": "All pujas", "href": "/puja-services"},
                    {"label": "Locations", "href": "/locations"},
                ],
            },
            {
                "title": "Company",
                "links": [
                    {"label": "About us", "href": "/about-us"},
                    {"label": "Testimonials", "href": "/testimonials"},
                    {"label": "FAQs", "href": "/faqs"},
                    {"label": "Contact", "href": "/contact-us"},
                ],
            },
            {
                "title": "Policies",
                "links": [
                    {"label": "Privacy policy", "href": "/privacy-policy"},
                    {"label": "Terms & conditions", "href": "/terms-and-conditions"},
                    {
                        "label": "Cancellation & refund",
                        "href": "/cancellation-refund-policy",
                    },
                ],
            },
        ]
    },
    "social": {"facebook": "", "instagram": "", "youtube": ""},
    "seo_defaults": {
        "title_suffix": " | Pandit Ji Express",
        "default_description": (
            "Book verified, experienced pandits for authentic pujas with "
            "transparent pricing and samagri included."
        ),
    },
}

CATEGORIES = [
    {
        "slug": "griha-pujan",
        "name": "Griha Pujan",
        "description": "Pujas for a new or existing home — peace, prosperity and protection.",
    },
    {
        "slug": "festival-pujas",
        "name": "Festival Pujas",
        "description": "Seasonal and festival pujas performed as per tradition.",
    },
    {
        "slug": "shanti-dosh-nivaran",
        "name": "Shanti & Dosh Nivaran",
        "description": "Pujas and paath for grah shanti and dosh nivaran.",
    },
]

SERVICES = [
    {
        "slug": "satyanarayan-katha",
        "title": "Satyanarayan Katha",
        "category": "griha-pujan",
        "price": 2100,
        "duration_label": "2–3 hours",
        "summary": "A complete Satyanarayan Katha performed at your home by an experienced pandit.",
        "description": (
            "The Satyanarayan Katha is a widely performed puja seeking the blessings "
            "of Lord Vishnu for well-being and prosperity. Our pandit arrives on time, "
            "guides your family through every step, and performs the katha and aarti "
            "as per tradition.\n\n*(Placeholder description — edit in admin.)*"
        ),
        "inclusions": ["Experienced pandit", "Full vidhi & katha", "Aarti & prasad guidance"],
        "samagri": ["Complete samagri kit", "Flowers & fruits", "Panchamrit ingredients"],
        "featured": True,
        "status": PUB,
    },
    {
        "slug": "griha-pravesh-puja",
        "title": "Griha Pravesh Puja",
        "category": "griha-pujan",
        "price": 3100,
        "duration_label": "3–4 hours",
        "summary": "Traditional housewarming puja for a new home.",
        "description": "Vastu-aligned Griha Pravesh puja for a peaceful, prosperous new beginning.\n\n*(Placeholder description — edit in admin.)*",
        "inclusions": ["Experienced pandit", "Kalash sthapana", "Havan & aarti"],
        "samagri": ["Complete havan samagri", "Kalash & coconut", "Mango leaves & flowers"],
        "featured": True,
        "status": PUB,
    },
    {
        "slug": "ganesh-puja",
        "title": "Ganesh Puja",
        "category": "festival-pujas",
        "price": 1500,
        "duration_label": "1–2 hours",
        "summary": "Invoke Lord Ganesha before any auspicious beginning.",
        "description": "A focused Ganesh puja to remove obstacles before new ventures and occasions.\n\n*(Placeholder description — edit in admin.)*",
        "inclusions": ["Experienced pandit", "Sankalp & puja vidhi", "Aarti"],
        "samagri": ["Puja samagri kit", "Modak offering items", "Durva & flowers"],
        "featured": False,
        "status": PUB,
    },
    {
        "slug": "navagraha-shanti-puja",
        "title": "Navagraha Shanti Puja",
        "category": "shanti-dosh-nivaran",
        "price": 5100,
        "duration_label": "4–5 hours",
        "summary": "Puja and havan to pacify the nine planets.",
        "description": "Navagraha Shanti puja and havan for grah dosh nivaran and overall harmony.\n\n*(Placeholder description — edit in admin.)*",
        "inclusions": ["Experienced pandit", "Navagraha havan", "Aarti & sankalp"],
        "samagri": ["Navagraha samidha", "Complete havan samagri", "Nine-grain offering"],
        "featured": False,
        "status": PUB,
    },
    {
        "slug": "rudrabhishek",
        "title": "Rudrabhishek",
        "category": "shanti-dosh-nivaran",
        "price": None,  # price on request — demonstrates the "On request" state
        "duration_label": "2–3 hours",
        "summary": "Abhishek of Lord Shiva with Vedic chanting.",
        "description": "Rudrabhishek performed with Rudri paath for health, peace and prosperity.\n\n*(Placeholder description — edit in admin.)*",
        "inclusions": ["Experienced pandit", "Rudri paath", "Abhishek & aarti"],
        "samagri": ["Abhishek samagri", "Bel patra & flowers", "Panchamrit"],
        "featured": False,
        "status": PUB,
    },
    {
        "slug": "mahalakshmi-puja",
        "title": "Mahalakshmi Puja",
        "category": "festival-pujas",
        "price": 2500,
        "duration_label": "2 hours",
        "summary": "Draft example — not visible on the public site.",
        "description": "This service is left as a DRAFT to demonstrate that drafts never appear publicly or in the sitemap.",
        "inclusions": ["Experienced pandit", "Puja vidhi", "Aarti"],
        "samagri": ["Puja samagri kit"],
        "featured": False,
        "status": ContentStatus.DRAFT,
    },
]

LOCATIONS = [
    {
        "slug": "delhi",
        "city": "Delhi",
        "region": "NCR",
        "description": "Pandit booking across Delhi for home and community pujas.",
    },
    {
        "slug": "noida",
        "city": "Noida",
        "region": "Uttar Pradesh",
        "description": "Experienced pandits available across Noida and Greater Noida.",
    },
    {
        "slug": "gurugram",
        "city": "Gurugram",
        "region": "Haryana",
        "description": "Book pandits for pujas across Gurugram sectors.",
    },
]

TESTIMONIALS = [
    {
        "author_name": "A. Sharma (sample)",
        "author_location": "Delhi",
        "service_label": "Satyanarayan Katha",
        "quote": "Placeholder testimonial — replace with genuine, authorised feedback in admin.",
        "rating": 5,
    },
    {
        "author_name": "R. Verma (sample)",
        "author_location": "Noida",
        "service_label": "Griha Pravesh Puja",
        "quote": "Placeholder testimonial — replace with genuine, authorised feedback in admin.",
        "rating": 5,
    },
]

GLOBAL_FAQS = [
    {
        "question": "How do I book a puja?",
        "answer": "Choose a puja, open its booking page and submit the enquiry form. Our team confirms the date, pandit and samagri with you.",
        "topic": "Booking",
    },
    {
        "question": "Is samagri included in the price?",
        "answer": "Where a puja lists samagri under its inclusions, the standard samagri kit is included. Any exceptions are noted on the puja page.",
        "topic": "Pricing",
    },
]

PAGES = [
    {
        "slug": "about-us",
        "title": "About Pandit Ji Express",
        "body": "## About us\n\n*(Placeholder — add your authentic business information in admin → Pages.)*",
    },
    {
        "slug": "contact-us",
        "title": "Contact us",
        "body": "## Contact\n\n*(Placeholder — verified contact methods are managed in admin → Settings.)*",
    },
    {
        "slug": "privacy-policy",
        "title": "Privacy Policy",
        "body": "## Privacy Policy\n\n*(Placeholder policy text — replace with your approved policy in admin → Pages.)*",
    },
    {
        "slug": "terms-and-conditions",
        "title": "Terms & Conditions",
        "body": "## Terms & Conditions\n\n*(Placeholder policy text — replace with your approved policy in admin → Pages.)*",
    },
    {
        "slug": "cancellation-refund-policy",
        "title": "Cancellation & Refund Policy",
        "body": "## Cancellation & Refund Policy\n\n*(Placeholder policy text — replace with your approved policy in admin → Pages.)*",
    },
]

HOMEPAGE_SECTIONS = [
    {
        "kind": "hero",
        "heading": "Authentic pujas, by experienced pandits",
        "subheading": "Transparent pricing, samagri included, and a pandit who arrives on time.",
        "cta_label": "Browse pujas",
        "cta_href": "/puja-services",
        "image_url": None,  # falls back to the bundled hero image; upload to override
        "sort_order": 0,
    },
    {
        "kind": "feature",
        "heading": "Everything arranged, nothing to worry about",
        "body": "Where a puja lists samagri under its inclusions, we bring the complete kit — so you don't have to run around gathering items.",
        "cta_label": "See what's included",
        "cta_href": "/puja-services",
        "image_url": None,
        "sort_order": 1,
    },
    {
        "kind": "cta",
        "heading": "Planning a Griha Pravesh or a special puja?",
        "subheading": "Tell us the occasion and your preferred date. We'll arrange an experienced pandit and confirm everything with you — no payment online.",
        "cta_label": "Browse pujas",
        "cta_href": "/puja-services",
        "image_url": None,
        "sort_order": 2,
    },
]


async def _wipe_content() -> None:
    async with async_session_maker() as s:
        for model in (
            HomepageSection,
            Faq,
            Testimonial,
            ServiceLocation,
            Location,
            Service,
            Category,
            Page,
            Setting,
        ):
            await s.execute(delete(model))
        await s.commit()
    print("Placeholder content wiped (admin account kept).")


async def _seed() -> None:
    async with async_session_maker() as s:
        # Admin
        email = settings.seed_admin_email.lower().strip()
        existing = (
            await s.execute(select(AdminUser).where(AdminUser.email == email))
        ).scalar_one_or_none()
        if existing is None:
            s.add(
                AdminUser(
                    email=email,
                    full_name="Site Admin",
                    password_hash=hash_password(settings.seed_admin_password),
                    role=Role.ADMIN,
                    status=AdminStatus.ACTIVE,
                )
            )
            print(f"Created admin: {email}")
        else:
            print(f"Admin already exists: {email}")

        # Settings
        for key, value in SETTINGS.items():
            row = (
                await s.execute(select(Setting).where(Setting.key == key))
            ).scalar_one_or_none()
            if row is None:
                s.add(Setting(key=key, value=value))

        # Categories
        cat_ids: dict[str, object] = {}
        for c in CATEGORIES:
            row = (
                await s.execute(select(Category).where(Category.slug == c["slug"]))
            ).scalar_one_or_none()
            if row is None:
                row = Category(
                    slug=c["slug"],
                    name=c["name"],
                    description=c["description"],
                    status=PUB,
                    published_at=utcnow(),
                )
                s.add(row)
                await s.flush()
            cat_ids[c["slug"]] = row.id

        # Services
        for sv in SERVICES:
            row = (
                await s.execute(select(Service).where(Service.slug == sv["slug"]))
            ).scalar_one_or_none()
            if row is None:
                s.add(
                    Service(
                        slug=sv["slug"],
                        title=sv["title"],
                        summary=sv["summary"],
                        description=sv["description"],
                        price_paise=_rupees(sv["price"]) if sv["price"] else None,
                        duration_label=sv["duration_label"],
                        inclusions=sv["inclusions"],
                        samagri=sv["samagri"],
                        category_id=cat_ids.get(sv["category"]),
                        is_featured=sv["featured"],
                        status=sv["status"],
                        published_at=utcnow() if sv["status"] == PUB else None,
                    )
                )

        # Locations + service availability (link every published service)
        published_service_ids = (
            await s.execute(select(Service.id).where(Service.status == PUB))
        ).scalars().all()
        for loc_data in LOCATIONS:
            loc = (
                await s.execute(select(Location).where(Location.slug == loc_data["slug"]))
            ).scalar_one_or_none()
            if loc is None:
                loc = Location(
                    slug=loc_data["slug"],
                    city=loc_data["city"],
                    region=loc_data["region"],
                    description=loc_data["description"],
                    status=PUB,
                    published_at=utcnow(),
                )
                s.add(loc)
                await s.flush()
                for sid in published_service_ids:
                    s.add(ServiceLocation(location_id=loc.id, service_id=sid))

        # Testimonials
        for t in TESTIMONIALS:
            exists = (
                await s.execute(
                    select(Testimonial).where(Testimonial.author_name == t["author_name"])
                )
            ).scalar_one_or_none()
            if exists is None:
                s.add(
                    Testimonial(
                        author_name=t["author_name"],
                        author_location=t["author_location"],
                        service_label=t["service_label"],
                        quote=t["quote"],
                        rating=t["rating"],
                        status=PUB,
                        published_at=utcnow(),
                    )
                )

        # Global FAQs
        for f in GLOBAL_FAQS:
            exists = (
                await s.execute(select(Faq).where(Faq.question == f["question"]))
            ).scalar_one_or_none()
            if exists is None:
                s.add(
                    Faq(
                        question=f["question"],
                        answer=f["answer"],
                        topic=f["topic"],
                        status=PUB,
                        published_at=utcnow(),
                    )
                )

        # Pages
        for p in PAGES:
            exists = (
                await s.execute(select(Page).where(Page.slug == p["slug"]))
            ).scalar_one_or_none()
            if exists is None:
                s.add(
                    Page(
                        slug=p["slug"],
                        title=p["title"],
                        body=p["body"],
                        status=PUB,
                        published_at=utcnow(),
                    )
                )

        # Homepage sections
        for sec in HOMEPAGE_SECTIONS:
            exists = (
                await s.execute(
                    select(HomepageSection).where(
                        HomepageSection.kind == sec["kind"],
                        HomepageSection.sort_order == sec["sort_order"],
                    )
                )
            ).scalar_one_or_none()
            if exists is None:
                s.add(
                    HomepageSection(
                        kind=sec["kind"],
                        heading=sec.get("heading"),
                        subheading=sec.get("subheading"),
                        body=sec.get("body"),
                        cta_label=sec.get("cta_label"),
                        cta_href=sec.get("cta_href"),
                        image_url=sec.get("image_url"),
                        sort_order=sec["sort_order"],
                        status=PUB,
                        published_at=utcnow(),
                    )
                )

        await s.commit()
    print("Seed complete. Placeholder content is live; replace it via the admin panel.")


def main() -> None:
    if "--wipe-content" in sys.argv:
        asyncio.run(_wipe_content())
    else:
        asyncio.run(_seed())


if __name__ == "__main__":
    main()
