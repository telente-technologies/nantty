import json
import secrets
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest

from src.app import create_application
from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.utils.request_signature_util import compute_request_signature_header_value

TEST_SHARED_SECRET = "test-shared-secret-that-is-long-enough-000"


@pytest.fixture
def reference_now() -> datetime:
    return (datetime.now(UTC) - timedelta(minutes=1)).replace(microsecond=0)


@pytest.fixture
def intelligence_settings(tmp_path: Path) -> IntelligenceSettings:
    return IntelligenceSettings(
        environment="test",
        shared_secret=TEST_SHARED_SECRET,
        event_storage_uri=str(tmp_path / "data"),
        model_registry_path=tmp_path / "registry",
        redis_url="",
    )


@pytest.fixture
def feature_backend() -> InMemoryFeatureBackend:
    return InMemoryFeatureBackend()


@pytest.fixture
def application_container(
    intelligence_settings: IntelligenceSettings, feature_backend: InMemoryFeatureBackend
) -> ApplicationContainer:
    return build_application_container(intelligence_settings, feature_backend)


def build_signed_headers(
    method: str, path_with_query: str, body: bytes, secret: str = TEST_SHARED_SECRET, timestamp: int | None = None
) -> dict[str, str]:
    unix_timestamp = str(timestamp if timestamp is not None else int(time.time()))
    nonce = secrets.token_urlsafe(18)
    signature = compute_request_signature_header_value(secret, method, path_with_query, unix_timestamp, nonce, body)
    return {
        "content-type": "application/json",
        "x-nantty-timestamp": unix_timestamp,
        "x-nantty-nonce": nonce,
        "x-nantty-signature": signature,
    }


class SignedIntelligenceClient:
    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self.http_client = http_client

    async def post(self, path: str, payload: Any) -> httpx.Response:
        body = json.dumps(payload).encode("utf-8")
        return await self.http_client.post(path, content=body, headers=build_signed_headers("POST", path, body))

    async def get(self, path_with_query: str) -> httpx.Response:
        return await self.http_client.get(path_with_query, headers=build_signed_headers("GET", path_with_query, b""))


@pytest.fixture
async def signed_client(
    intelligence_settings: IntelligenceSettings, feature_backend: InMemoryFeatureBackend
) -> AsyncIterator[SignedIntelligenceClient]:
    application = create_application(intelligence_settings, feature_backend, start_background_tasks=False)
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://intelligence.internal") as http_client:
        yield SignedIntelligenceClient(http_client)


def build_event(
    event_id: str, event_type: str, actor_id: str, occurred_at: datetime, payload: dict[str, Any], **envelope: Any
) -> dict[str, Any]:
    return {
        "eventId": event_id,
        "eventType": event_type,
        "occurredAt": occurred_at.isoformat(),
        "actorId": actor_id,
        "payload": payload,
        **envelope,
    }


def build_viewer(user_id: str = "viewer_1", **overrides: Any) -> dict[str, Any]:
    return {"userId": user_id, "country": "NG", **overrides}
