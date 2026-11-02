"""Seed marketplace demo data: approved pandits in Kanpur, a pending applicant
and a test customer. Placeholder data for exercising the dispatch flow.

Run after the content seed + migration:  python seed_marketplace.py
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.constants import ContentStatus
from app.db.session import async_session_maker
from app.marketplace.constants import Availability, PanditStatus
from app.marketplace.models import Customer, Pandit, PanditCapability
from app.models.service import Service

# Kanpur city centre-ish
KANPUR = (26.4499, 80.3319)

PANDITS = [
    {
        "phone": "+919000000001", "name": "Pandit Sharma", "city": "Kanpur",
        "languages": ["Hindi", "Sanskrit"], "base": (26.46, 80.33),
        "radius": 15, "status": PanditStatus.APPROVED, "availability": Availability.ONLINE,
        "services": ["satyanarayan-katha", "griha-pravesh-puja", "ganesh-puja"],
    },
    {
        "phone": "+919000000002", "name": "Pandit Mishra", "city": "Kanpur",
        "languages": ["Hindi"], "base": (26.44, 80.35),
        "radius": 10, "status": PanditStatus.APPROVED, "availability": Availability.ONLINE,
        "services": ["satyanarayan-katha", "navagraha-shanti-puja", "rudrabhishek"],
    },
    {
        "phone": "+919000000003", "name": "Pandit Dwivedi", "city": "Kanpur",
        "languages": ["Hindi", "Sanskrit", "English"], "base": (26.50, 80.28),
        "radius": 20, "status": PanditStatus.APPROVED, "availability": Availability.ONLINE,
        "services": ["satyanarayan-katha", "griha-pravesh-puja", "ganesh-puja",
                     "navagraha-shanti-puja", "rudrabhishek"],
    },
    {
        "phone": "+919000000004", "name": "Pandit Trivedi (applicant)", "city": "Kanpur",
        "languages": ["Hindi"], "base": (26.47, 80.31),
        "radius": 12, "status": PanditStatus.SUBMITTED, "availability": Availability.OFFLINE,
        "services": ["satyanarayan-katha"],
    },
]


async def _seed() -> None:
    async with async_session_maker() as s:
        svc_by_slug = {
            row.slug: row
            for row in (
                await s.execute(
                    select(Service).where(Service.status == ContentStatus.PUBLISHED)
                )
            ).scalars().all()
        }

        for data in PANDITS:
            existing = (
                await s.execute(select(Pandit).where(Pandit.phone == data["phone"]))
            ).scalar_one_or_none()
            if existing:
                continue
            p = Pandit(
                phone=data["phone"], name=data["name"], city=data["city"],
                languages=data["languages"],
                base_lat=data["base"][0], base_lng=data["base"][1],
                service_radius_km=data["radius"],
                status=data["status"], availability=data["availability"],
                last_heartbeat=datetime.now(UTC)
                if data["availability"] == Availability.ONLINE else None,
            )
            s.add(p)
            await s.flush()
            for slug in data["services"]:
                svc = svc_by_slug.get(slug)
                if svc:
                    s.add(PanditCapability(pandit_id=p.id, service_id=svc.id))

        cust = (
            await s.execute(
                select(Customer).where(Customer.phone == "+919999900000")
            )
        ).scalar_one_or_none()
        if cust is None:
            s.add(Customer(phone="+919999900000", name="Test Customer", language="Hindi"))

        await s.commit()
    print(f"Marketplace seed complete. Kanpur centre: {KANPUR}")


if __name__ == "__main__":
    asyncio.run(_seed())
