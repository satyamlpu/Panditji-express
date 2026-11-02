"""Import all models so SQLAlchemy's metadata (and Alembic) sees every table."""

# Marketplace models (SRS Phase 1) — imported for side effects so their tables
# register on Base.metadata.
import app.marketplace.models  # noqa: F401
from app.models.admin_user import AdminUser
from app.models.audit import AuditLog
from app.models.banner import HomepageSection
from app.models.category import Category
from app.models.enquiry import BookingEnquiry
from app.models.faq import Faq
from app.models.location import Location, ServiceLocation
from app.models.page import Page
from app.models.redirect import Redirect
from app.models.refresh_token import RefreshToken
from app.models.service import Service
from app.models.setting import Setting
from app.models.testimonial import Testimonial

__all__ = [
    "AdminUser",
    "AuditLog",
    "BookingEnquiry",
    "Category",
    "Faq",
    "HomepageSection",
    "Location",
    "Page",
    "Redirect",
    "RefreshToken",
    "Service",
    "ServiceLocation",
    "Setting",
    "Testimonial",
]
