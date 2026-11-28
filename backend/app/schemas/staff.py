"""Schemas for staff/role management (super-admin only)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

StaffRoleName = Literal["ops", "verification", "finance", "support", "marketing", "admin"]
StaffStatus = Literal["active", "disabled"]


class StaffOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    status: str
    created_at: datetime


class StaffUpdate(BaseModel):
    role: StaffRoleName | None = None
    status: StaffStatus | None = None
