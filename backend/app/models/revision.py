"""ContentRevision — an append-only snapshot history for CMS content.

Every create / update / publish / unpublish of an editable content entity
(service, category, page, setting, homepage section, …) records a full JSON
snapshot of the entity *after* the change, together with who made it and when.
This gives Website Management a per-item revision history (view older versions,
see what changed, and — with the restore endpoint — roll back).

It complements, rather than replaces, the ``audit_log`` (see
``app/services/audit.py`` / ``app/models/audit.py``): the audit log is the terse
"who did what" security trail across the whole admin; a revision carries the
actual content snapshot for a single entity.
"""

from __future__ import annotations

import uuid

from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.db.types import GUID


class ContentRevision(UUIDPk, Timestamps, Base):
    __tablename__ = "content_revision"

    # Logical entity type, e.g. "service", "category", "page", "setting".
    entity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # The entity's id as a string (uuid for most, the key for settings).
    entity_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # Monotonic per-entity version number (1, 2, 3 …).
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # What happened: "create" | "update" | "publish" | "unpublish" | "restore".
    action: Mapped[str] = mapped_column(String, nullable=False)
    # Full snapshot of the entity's content after the change.
    snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    actor_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    actor_email: Mapped[str | None] = mapped_column(String, nullable=True)
