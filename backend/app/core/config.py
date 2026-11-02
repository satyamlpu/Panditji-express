"""Application settings, loaded from the environment (.env) via pydantic-settings.

Everything here is server-side. Secrets never leave the backend process.
Adapted from the FlowDesk foundation (same security posture), trimmed to the
needs of a content-driven public site + admin.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# A deployment that still uses any of these values in production is
# misconfigured; the app refuses to start rather than silently run on a
# known-public secret (JWT forgery, payment-webhook forgery, cache poisoning).
_INSECURE_JWT_SECRET = "change-me-in-production"
_INSECURE_WEBHOOK_SECRET = "dev-mock-payment-secret"
_INSECURE_REVALIDATE_SECRET = "change-me-revalidate-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_env: str = "development"
    debug: bool = True
    app_name: str = "Pandit Ji Express"

    # Database — one URL shared by the async app engine and sync Alembic engine.
    database_url: str = "sqlite+aiosqlite:///./panditji.db"

    # JWT
    jwt_secret: str = _INSECURE_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Refresh cookie
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Rate limiting (in-process token buckets)
    rate_limit_login_per_min: int = 10
    rate_limit_enquiry_per_hour: int = 8

    # On-demand revalidation of the Next.js frontend
    frontend_revalidate_url: str = "http://localhost:3000/api/revalidate"
    revalidate_secret: str = _INSECURE_REVALIDATE_SECRET

    # Public site base URL (sitemap / canonicals / JSON-LD)
    site_url: str = "http://localhost:3000"

    # Seed admin
    seed_admin_email: str = "admin@panditjiexpress.in"
    seed_admin_password: str = "Admin!Pandit123"

    # Marketplace payments (mock gateway in dev). The webhook secret signs the
    # provider callback; a real gateway (e.g. Razorpay) replaces the mock while
    # the verification + idempotency + ledger flow stays the same.
    payment_webhook_secret: str = _INSECURE_WEBHOOK_SECRET
    platform_commission_percent: float = 15.0
    gateway_fee_percent: float = 2.0

    # Geo matching backend for dispatch eligibility. "haversine" scans in Python
    # (dev/SQLite, correct but O(n)); "postgis" uses an indexed ST_DWithin radius
    # filter (production, requires the PostGIS migration). Ranking is identical.
    geo_backend: str = "haversine"

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        """Managed Postgres hosts hand out `postgres://`/`postgresql://` URLs.
        SQLAlchemy needs an explicit driver, so normalise to async psycopg."""
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://") :]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://") :]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Synchronous URL for Alembic.

        Only the async-only SQLite driver is stripped (``pysqlite`` is the sync
        default). psycopg 3 serves both sync and async, so ``+psycopg`` is kept —
        dropping it would fall back to psycopg2, which this project does not ship.
        """
        return self.database_url.replace("+aiosqlite", "")

    def validate_runtime(self) -> None:
        """Fail fast on an unsafe production configuration (called at startup).

        A production process may not boot while any security-critical secret is
        still its public default, and never with verbose error bodies on.
        """
        if not self.is_production:
            return
        insecure = [
            name
            for name, value, placeholder in (
                ("JWT_SECRET", self.jwt_secret, _INSECURE_JWT_SECRET),
                (
                    "PAYMENT_WEBHOOK_SECRET",
                    self.payment_webhook_secret,
                    _INSECURE_WEBHOOK_SECRET,
                ),
                ("REVALIDATE_SECRET", self.revalidate_secret, _INSECURE_REVALIDATE_SECRET),
            )
            if value == placeholder
        ]
        if insecure:
            raise RuntimeError(
                "Refusing to start in production with default secrets: "
                + ", ".join(insecure)
                + ". Set each to a real, unique value."
            )
        # Verbose error bodies (see app/core/errors.py) must never leak in prod.
        self.debug = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
