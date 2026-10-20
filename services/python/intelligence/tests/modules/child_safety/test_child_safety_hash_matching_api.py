import base64
import hashlib
import os
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from src.app import create_application
from src.configs.settings_config import IntelligenceSettings
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from tests.conftest import TEST_SHARED_SECRET, SignedIntelligenceClient


@pytest.fixture
async def synthetic_client(tmp_path: Path) -> AsyncIterator[tuple[SignedIntelligenceClient, bytes]]:
    flagged = os.urandom(400)
    settings = IntelligenceSettings(
        environment="test",
        shared_secret=TEST_SHARED_SECRET,
        event_storage_uri=str(tmp_path / "data"),
        model_registry_path=tmp_path / "registry",
        redis_url="",
        child_safety_hash_provider="synthetic",
        child_safety_synthetic_hashes=hashlib.sha256(flagged).hexdigest(),
    )
    application = create_application(settings, InMemoryFeatureBackend(), start_background_tasks=False)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application), base_url="http://intel") as http:
        yield SignedIntelligenceClient(http), flagged


async def test_scan_media_endpoint_reports_a_block_in_the_media_contract(
    synthetic_client: tuple[SignedIntelligenceClient, bytes],
) -> None:
    client, flagged = synthetic_client
    payload = {
        "mediaId": "0192f3a0-0000-7000-8000-00000000c5a1",
        "ownerId": "0192f3a0-0000-7000-8000-00000000c5a2",
        "purpose": "post",
        "kind": "image",
        "originalSha256": hashlib.sha256(flagged).hexdigest(),
        "frames": [{"mimeType": "image/jpeg", "dataBase64": base64.b64encode(os.urandom(64)).decode()}],
    }
    response = await client.post("/v1/moderation/scan-media", payload)
    assert response.status_code == 200
    body = response.json()
    assert body["childSafety"] == {
        "blocked": True,
        "signal": "hash_match",
        "hashCheck": "matched",
        "provider": "synthetic-sha256",
        "matchReference": body["childSafety"]["matchReference"],
    }
    assert body["suggestedAction"] == "block"
    clean = await client.post(
        "/v1/moderation/scan-media",
        {**payload, "originalSha256": hashlib.sha256(os.urandom(9)).hexdigest()},
    )
    assert clean.json()["childSafety"]["blocked"] is False
    assert clean.json()["childSafety"]["hashCheck"] == "clear"
    malformed = await client.post(
        "/v1/moderation/scan-media", {**payload, "frames": [{"dataBase64": "!!!not-base64!!!"}]}
    )
    assert malformed.status_code == 422
