"""Schemas for app-release management (admin) and the public /download feed."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AppType = Literal["customer", "partner"]
Platform = Literal["android", "ios"]
Channel = Literal["beta", "production"]


class AppReleaseCreate(BaseModel):
    app_type: AppType
    platform: Platform
    channel: Channel = "beta"
    version: str = Field(min_length=1, max_length=40)
    build_number: int | None = Field(default=None, ge=0)
    download_url: str | None = Field(default=None, max_length=1000)
    checksum_sha256: str | None = Field(default=None, max_length=128)
    release_notes: str | None = None
    min_supported_version: str | None = Field(default=None, max_length=40)
    is_active: bool = False


class AppReleaseUpdate(BaseModel):
    channel: Channel | None = None
    version: str | None = Field(default=None, min_length=1, max_length=40)
    build_number: int | None = Field(default=None, ge=0)
    download_url: str | None = Field(default=None, max_length=1000)
    checksum_sha256: str | None = Field(default=None, max_length=128)
    release_notes: str | None = None
    min_supported_version: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class AppReleaseOut(BaseModel):
    id: str
    app_type: str
    platform: str
    channel: str
    version: str
    build_number: int | None
    download_url: str | None
    checksum_sha256: str | None
    release_notes: str | None
    min_supported_version: str | None
    is_active: bool
    created_at: datetime


class AppReleasePublic(BaseModel):
    """Safe public projection — only what the download page needs."""

    app_type: str
    platform: str
    channel: str
    version: str
    build_number: int | None
    download_url: str | None
    checksum_sha256: str | None
    release_notes: str | None
    min_supported_version: str | None
