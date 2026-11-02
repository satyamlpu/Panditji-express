"""Async engine, session factory, and the per-request session dependency."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

# SQLite ignores pool sizing (one file, serialized writer); PostgreSQL gets an
# explicitly bounded pool so N stateless app instances don't exhaust server
# connections, with recycling to survive proxy/idle timeouts.
_pool_kwargs: dict = (
    {}
    if _is_sqlite
    else {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    }
)

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=not _is_sqlite,
    **_pool_kwargs,
)

if _is_sqlite:
    # SQLite does not enforce foreign keys unless asked to, per connection.
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _record):  # pragma: no cover - driver glue
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one transaction-scoped session per request.

    Commits on success, rolls back on any exception so a failed request never
    leaves a half-written transaction behind.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
