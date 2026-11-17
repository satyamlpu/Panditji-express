"""Auth request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    # Enforce a reasonable minimum; the endpoint also rejects re-using the
    # current password.
    new_password: str = Field(min_length=12, max_length=128)


class AdminOut(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: str
    status: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminOut


class RefreshResponse(BaseModel):
    access_token: str


class MessageResponse(BaseModel):
    message: str
