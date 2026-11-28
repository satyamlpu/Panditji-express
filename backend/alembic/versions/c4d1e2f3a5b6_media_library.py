"""media_asset table (public Media Library for website images) — SUPERSEDED

Revision ID: c4d1e2f3a5b6
Revises: b8d0e1f2a3c4
Create Date: 2026-11-22 10:00:00.000000

NOTE (merge reconciliation, release/full x main): the ``media_asset`` table is
now created by the later, richer CMS migration ``d4f7b1a9c2e8`` (PR #16 — adds
storage variants, url/thumb_url, dimensions, content_revision and the
service/category thumbnail columns). That migration is the single authoritative
source of the Media Library schema. To avoid creating ``media_asset`` twice in
the unified history, this revision is intentionally a NO-OP. Its revision node
is kept so the existing chain (d5e2f3a4b6c7 -> c4d1e2f3a5b6 -> b8d0e1f2a3c4)
stays intact; ``e7a1b2c3d4f5`` now also depends on ``d4f7b1a9c2e8`` so the table
is created before the RLS lock-down runs.
"""
from __future__ import annotations

from collections.abc import Sequence

revision: str = "c4d1e2f3a5b6"
down_revision: str | None = "b8d0e1f2a3c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # No-op: media_asset is created by d4f7b1a9c2e8 (PR #16). See module docstring.
    pass


def downgrade() -> None:
    # No-op: the table is dropped by d4f7b1a9c2e8's downgrade.
    pass
