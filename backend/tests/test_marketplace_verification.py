"""Partner KYC verification flow: submit documents (with private file upload)
→ admin review (incl. gated file download) → decision."""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.marketplace import storage
from app.marketplace.constants import Availability, PanditStatus
from app.models.service import Service
from tests.conftest import TestSession
from tests.test_marketplace import LAT, LNG, _auth, _make_pandit, _token

# A minimal valid 1x1 PNG.
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f6b0000000049454e44ae426082"
)


@pytest_asyncio.fixture
async def service_id() -> str:
    async with TestSession() as s:
        svc = (
            await s.execute(select(Service).where(Service.slug == "published-puja"))
        ).scalar_one()
        return str(svc.id)


@pytest.fixture(autouse=True)
def _local_storage(tmp_path, monkeypatch):
    """Point KYC storage at a throwaway dir so tests never touch the repo tree."""
    monkeypatch.setattr(storage.settings, "storage_backend", "local", raising=False)
    monkeypatch.setattr(
        storage.settings, "storage_local_dir", str(tmp_path / "kyc"), raising=False
    )


async def test_verification_flow(client: AsyncClient, admin_token, service_id):
    pid = await _make_pandit(
        "+910000004001",
        LAT,
        LNG,
        service_id,
        status=PanditStatus.SUBMITTED,
        availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000004001", "pandit")

    # initially: submitted, no documents
    v0 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v0["status"] == "submitted"
    assert v0["documents"] == []

    # partner submits a KYC document WITH a file → status moves to under_review
    r = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        data={"doc_type": "id_proof", "note": "Aadhaar — last 4: 1234"},
        files={"file": ("aadhaar.png", _PNG, "image/png")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["reference"] == "Aadhaar — last 4: 1234"
    assert body["has_file"] is True
    assert body["content_type"] == "image/png"
    doc_id = body["id"]

    v1 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v1["status"] == "under_review"
    assert len(v1["documents"]) == 1
    assert v1["documents"][0]["doc_type"] == "id_proof"
    assert v1["documents"][0]["has_file"] is True

    # admin can see the submitted documents for review
    docs = (
        await client.get(
            f"/api/v1/mp/admin/pandits/{pid}/documents", headers=_auth(admin_token)
        )
    ).json()
    assert len(docs) == 1
    assert docs[0]["reference"] == "Aadhaar — last 4: 1234"
    assert docs[0]["has_file"] is True

    # admin downloads the actual file through the gated endpoint
    f = await client.get(
        f"/api/v1/mp/admin/pandits/{pid}/documents/{doc_id}/file",
        headers=_auth(admin_token),
    )
    assert f.status_code == 200, f.text
    assert f.headers["content-type"].startswith("image/png")
    assert f.headers["cache-control"] == "private, no-store"
    assert f.content == _PNG

    # admin approves → partner becomes approved
    dec = await client.post(
        f"/api/v1/mp/admin/pandits/{pid}/verification-decision",
        headers=_auth(admin_token),
        json={"decision": "approve"},
    )
    assert dec.status_code == 200, dec.text
    assert dec.json()["status"] == "approved"

    v2 = (await client.get("/api/v1/mp/partner/verification", headers=_auth(ptok))).json()
    assert v2["status"] == "approved"

    # once approved, further submissions are rejected
    dup = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        data={"doc_type": "id_proof"},
    )
    assert dup.status_code == 409


async def test_submit_note_only_has_no_file(client: AsyncClient, admin_token, service_id):
    pid = await _make_pandit(
        "+910000004002", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000004002", "pandit")

    r = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        data={"doc_type": "address_proof", "note": "electricity bill"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["has_file"] is False
    assert body["content_type"] is None

    # with no stored file, the admin download endpoint is a 404
    missing = await client.get(
        f"/api/v1/mp/admin/pandits/{pid}/documents/{body['id']}/file",
        headers=_auth(admin_token),
    )
    assert missing.status_code == 404


async def test_rejects_unsupported_file_type(client: AsyncClient, service_id):
    await _make_pandit(
        "+910000004003", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000004003", "pandit")
    r = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        data={"doc_type": "id_proof"},
        files={"file": ("evil.txt", b"not an image", "text/plain")},
    )
    assert r.status_code == 415, r.text


async def test_rejects_oversize_file(client: AsyncClient, service_id, monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "verification_max_upload_bytes", 8, raising=False)
    await _make_pandit(
        "+910000004004", LAT, LNG, service_id,
        status=PanditStatus.SUBMITTED, availability=Availability.OFFLINE,
    )
    ptok = await _token(client, "+910000004004", "pandit")
    r = await client.post(
        "/api/v1/mp/partner/verification/documents",
        headers=_auth(ptok),
        data={"doc_type": "id_proof"},
        files={"file": ("big.png", _PNG, "image/png")},  # 70+ bytes > 8-byte cap
    )
    assert r.status_code == 413, r.text


async def test_verification_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/mp/partner/verification")).status_code == 401
    assert (
        await client.get("/api/v1/mp/admin/pandits/00000000-0000-0000-0000-000000000000/documents")
    ).status_code == 401
    assert (
        await client.get(
            "/api/v1/mp/admin/pandits/00000000-0000-0000-0000-000000000000/documents/"
            "00000000-0000-0000-0000-000000000000/file"
        )
    ).status_code == 401
