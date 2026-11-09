"""Pandit Ji Express API entrypoint."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import (
    admin_banners,
    admin_categories,
    admin_enquiries,
    admin_faqs,
    admin_locations,
    admin_media,
    admin_pages,
    admin_services,
    admin_settings,
    admin_testimonials,
    auth,
    public,
)
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.middleware import SecurityHeadersMiddleware
from app.marketplace.routers import admin as mp_admin
from app.marketplace.routers import admin_finance as mp_admin_finance
from app.marketplace.routers import admin_support as mp_admin_support
from app.marketplace.routers import auth as mp_auth
from app.marketplace.routers import customer as mp_customer
from app.marketplace.routers import discovery as mp_discovery
from app.marketplace.routers import pandit as mp_pandit
from app.marketplace.routers import payments as mp_payments

settings.validate_runtime()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,  # required for the httpOnly refresh cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok", "env": settings.app_env}


app.include_router(auth.router)
app.include_router(admin_services.router)
app.include_router(admin_categories.router)
app.include_router(admin_locations.router)
app.include_router(admin_testimonials.router)
app.include_router(admin_faqs.router)
app.include_router(admin_pages.router)
app.include_router(admin_banners.router)
app.include_router(admin_settings.router)
app.include_router(admin_media.router)
app.include_router(admin_enquiries.router)
app.include_router(public.router)

# ── Marketplace (SRS Phase 1) ────────────────────────────────────────────────
app.include_router(mp_auth.router)
app.include_router(mp_customer.router)
app.include_router(mp_pandit.router)
app.include_router(mp_discovery.router)
app.include_router(mp_payments.router)
app.include_router(mp_admin.router)
app.include_router(mp_admin_finance.router)
app.include_router(mp_admin_support.router)

# Serve admin-uploaded images read-only (optional; the site works without any).
# On a read-only serverless filesystem (e.g. Vercel) the project dir can't be
# written, so fall back to the platform temp dir and never let this optional
# mount crash startup.
import tempfile  # noqa: E402

_uploads = Path("uploads")
try:
    _uploads.mkdir(parents=True, exist_ok=True)
except OSError:
    _uploads = Path(tempfile.gettempdir()) / "pje-uploads"
    _uploads.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads)), name="uploads")
