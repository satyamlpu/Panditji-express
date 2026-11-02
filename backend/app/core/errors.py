"""Standard error envelope and the exception handlers that produce it.

Every error response has the same shape:

    { "error": { "code": "...", "message": "...", "details": [...] } }
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings

logger = logging.getLogger("panditji")


class APIError(Exception):
    """Raised by the app to return a controlled error with the standard shape."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "error",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: list | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class NotFoundError(APIError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, code="not_found", status_code=status.HTTP_404_NOT_FOUND)


class ForbiddenError(APIError):
    def __init__(self, message: str = "Not authorized") -> None:
        super().__init__(message, code="forbidden", status_code=status.HTTP_403_FORBIDDEN)


class UnauthorizedError(APIError):
    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(
            message, code="unauthorized", status_code=status.HTTP_401_UNAUTHORIZED
        )


class ConflictError(APIError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message, code="conflict", status_code=status.HTTP_409_CONFLICT)


def _envelope(code: str, message: str, details: list) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def _handle_api_error(_: Request, exc: APIError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            409: "conflict",
            429: "rate_limited",
        }.get(exc.status_code, "error")
        headers = getattr(exc, "headers", None)
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(code, str(exc.detail), []),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("validation_error", "Validation failed", details),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Never leak stack traces, SQL or paths to clients in production.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        message = str(exc) if settings.debug else "Internal server error"
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("internal_error", message, []),
        )
