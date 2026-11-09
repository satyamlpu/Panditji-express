"""Async engine, session factory, and the per-request session dependency."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
# Vercel (and most FaaS) set VERCEL/AWS_LAMBDA_* — each invocation is its own
# short-lived process, so an in-process pool is useless and can exhaust the DB.
_is_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

# SQLite ignores pool sizing (one file, serialized writer). On serverless, use
# NullPool (one connection per invocation) and point DATABASE_URL at a pooled
# (pgbouncer) Postgres endpoint. A long-lived server gets a bounded pool with
# recycling so N instances don't exhaust connections.
if _is_sqlite:
    _pool_kwargs: dict = {}
elif _is_serverless:
    _pool_kwargs = {"poolclass": NullPool}
else:
    _pool_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    }

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
