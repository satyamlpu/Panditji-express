"""TEMPORARY diagnostic endpoint — isolates whether dependencies install on
Vercel and, if they do, which application import fails. Imports nothing from the
app at module load, connects to no database, exposes no secrets. Remove once the
deployment is fixed.
"""

from fastapi import FastAPI

app = FastAPI()


@app.get("/diag")
def diag() -> dict:
    # Reaching this response at all proves `fastapi` is installed in the function.
    out: dict[str, str] = {"fastapi": "ok"}
    for name in (
        "sqlalchemy",
        "pydantic",
        "pydantic_settings",
        "psycopg",
        "app.core.config",
        "app.db.session",
        "app.main",
    ):
        try:
            __import__(name)
            out[name] = "ok"
        except Exception as exc:  # noqa: BLE001 - report, don't crash
            out[name] = f"FAIL {type(exc).__name__}: {str(exc)[:160]}"
    return out
