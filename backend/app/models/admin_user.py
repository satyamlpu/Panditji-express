"""Admin user — the only authenticated principal on the site.

The public site is anonymous; all content management requires an admin account.
Kept as a single role for now (expandable to RBAC later), re-resolved from the
DB on every privileged request rather than trusted from the token.
"""

from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import AdminStatus, Role
from app.db.base import Base, Timestamps, UUIDPk


class AdminUser(UUIDPk, Timestamps, Base):
    __tablename__ = "admin_user"

    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(nullable=True)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(default=Role.ADMIN, nullable=False)
    status: Mapped[str] = mapped_column(default=AdminStatus.ACTIVE, nullable=False)
