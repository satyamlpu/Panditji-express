"""Small shared response schemas."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str


class Page(BaseModel, Generic[T]):
    """A single page of a listing."""

    items: list[T]
    total: int
    page: int
    page_size: int
