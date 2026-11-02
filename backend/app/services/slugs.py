"""Slug helpers."""

from __future__ import annotations

import re

_slug_re = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    s = _slug_re.sub("-", text.strip().lower()).strip("-")
    return s or "item"
