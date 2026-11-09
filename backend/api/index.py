"""Vercel serverless entrypoint.

Vercel's Python runtime detects the ASGI ``app`` exported here and serves every
request through it (see ../vercel.json, which rewrites all paths to this
function). The real application lives in ``app.main``.
"""

from app.main import app

__all__ = ["app"]
