"""Shared enumerations and small constants used across models and services."""

from __future__ import annotations


class ContentStatus:
    """Publication lifecycle for any editable public content."""

    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"

    ALL = (DRAFT, PUBLISHED, UNPUBLISHED)


class EnquiryStatus:
    """Lifecycle of a customer booking enquiry."""

    NEW = "new"
    CONTACTED = "contacted"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

    ALL = (NEW, CONTACTED, CONFIRMED, CANCELLED)


class AdminStatus:
    ACTIVE = "active"
    DISABLED = "disabled"


class Role:
    ADMIN = "admin"


class Audit:
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    CREATE = "content.create"
    UPDATE = "content.update"
    DELETE = "content.delete"
    PUBLISH = "content.publish"
    UNPUBLISH = "content.unpublish"
    SLUG_CHANGE = "content.slug_change"
    ENQUIRY_UPDATE = "enquiry.update"
