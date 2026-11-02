"""Test fixtures: an isolated SQLite database, dependency overrides and an
httpx client bound to the ASGI app. No network or external services needed."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Default to a dedicated SQLite file; CI overrides DATABASE_URL to point at a
# PostgreSQL service so the same suite (concurrency tests included) runs on the
# production engine. Set before the app imports settings.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./panditji_test.db")

from app.core.config import settings
from app.core.constants import AdminStatus, ContentStatus, Role
from app.core.security import hash_password
from app.db.base import Base, utcnow
from app.db.session import get_session
from app.main import app
from app.models.admin_user import AdminUser
from app.models.service import Service

# Normalised by Settings (e.g. postgres:// → postgresql+psycopg://).
TEST_DB_URL = settings.database_url
IS_SQLITE = TEST_DB_URL.startswith("sqlite")

engine = create_async_engine(TEST_DB_URL, future=True)
TestSession = async_sessionmaker(engine, expire_on_commit=False)

ADMIN_EMAIL = "tester@panditjiexpress.in"
ADMIN_PASSWORD = "Test!Pandit123"


async def _override_get_session() -> AsyncGenerator:
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(autouse=True)
async def _db() -> AsyncGenerator:
    # Reset the in-process rate-limiter so repeated logins across tests don't
    # trip the per-minute login cap.
    from app.core import ratelimit

    ratelimit._buckets.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_session] = _override_get_session

    # Seed one admin, one published and one draft service.
    async with TestSession() as s:
        s.add(
            AdminUser(
                email=ADMIN_EMAIL,
                full_name="Tester",
                password_hash=hash_password(ADMIN_PASSWORD),
                role=Role.ADMIN,
                status=AdminStatus.ACTIVE,
            )
        )
        s.add(
            Service(
                slug="published-puja",
                title="Published Puja",
                summary="A visible puja.",
                price_paise=210000,
                status=ContentStatus.PUBLISHED,
                published_at=utcnow(),
            )
        )
        s.add(
            Service(
                slug="draft-puja",
                title="Draft Puja",
                status=ContentStatus.DRAFT,
            )
        )
        await s.commit()

    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]
