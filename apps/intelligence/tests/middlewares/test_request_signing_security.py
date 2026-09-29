import json
import time

import httpx
import pytest

from src.app import create_application
from src.configs.settings_config import IntelligenceSettings
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.utils.request_signature_util import compute_request_signature_header_value, verify_signed_request_headers
from tests.conftest import TEST_SHARED_SECRET, SignedIntelligenceClient, build_signed_headers, build_viewer

VALID_NONCE = "nonce_abcdefghijklmnop"
FEED_BODY = json.dumps({"viewer": build_viewer(), "candidates": []}).encode("utf-8")


def verify_with_defaults(**overrides: object) -> str | None:
    now = 1_790_000_000
    arguments: dict[str, object] = {
        "accepted_shared_secrets": [TEST_SHARED_SECRET],
        "http_method": "POST",
        "path_with_query": "/v1/feed/rank",
        "timestamp_header_value": str(now),
        "nonce_header_value": VALID_NONCE,
        "signature_header_value": compute_request_signature_header_value(
            TEST_SHARED_SECRET, "POST", "/v1/feed/rank", str(now), VALID_NONCE, FEED_BODY
        ),
        "body_bytes": FEED_BODY,
        "current_unix_time_seconds": float(now),
        "maximum_clock_skew_seconds": 300,
    }
    arguments.update(overrides)
    outcome = verify_signed_request_headers(**arguments)  # type: ignore[arg-type]
    return None if outcome.is_valid else outcome.failure_reason


def test_valid_signature_is_accepted() -> None:
    assert verify_with_defaults() is None


@pytest.mark.parametrize(
    ("overrides", "expected_reason"),
    [
        ({"body_bytes": FEED_BODY + b" "}, "signature_mismatch"),
        ({"http_method": "PUT"}, "signature_mismatch"),
        ({"path_with_query": "/v1/clips/rank"}, "signature_mismatch"),
        ({"accepted_shared_secrets": ["another-secret-entirely-000000000000"]}, "signature_mismatch"),
        ({"current_unix_time_seconds": 1_790_000_301.0}, "timestamp_outside_allowed_window"),
        ({"current_unix_time_seconds": 1_789_999_699.0}, "timestamp_outside_allowed_window"),
        ({"timestamp_header_value": "yesterday"}, "malformed_timestamp"),
        ({"nonce_header_value": "short"}, "malformed_nonce"),
        ({"signature_header_value": "sha256=abc"}, "malformed_signature"),
        ({"signature_header_value": None}, "missing_signature_headers"),
    ],
)
def test_tampered_or_stale_requests_are_rejected(overrides: dict[str, object], expected_reason: str) -> None:
    assert verify_with_defaults(**overrides) == expected_reason


def test_clock_skew_inside_window_is_accepted() -> None:
    assert verify_with_defaults(current_unix_time_seconds=1_790_000_299.0) is None


def test_previous_secret_is_accepted_during_rotation() -> None:
    assert (
        verify_with_defaults(accepted_shared_secrets=["", "rotated-new-secret-000000000000000", TEST_SHARED_SECRET])
        is None
    )


async def test_unsigned_request_is_rejected_but_health_is_open(signed_client: SignedIntelligenceClient) -> None:
    unsigned = await signed_client.http_client.post("/v1/feed/rank", content=FEED_BODY)
    assert unsigned.status_code == 401
    assert unsigned.json() == {"error": {"code": "unauthenticated"}}
    assert (await signed_client.http_client.get("/health/live")).status_code == 200
    assert (await signed_client.http_client.get("/health/ready")).json() == {"status": "ready"}


async def test_replayed_nonce_is_rejected(signed_client: SignedIntelligenceClient) -> None:
    headers = build_signed_headers("POST", "/v1/feed/rank", FEED_BODY)
    first = await signed_client.http_client.post("/v1/feed/rank", content=FEED_BODY, headers=headers)
    replay = await signed_client.http_client.post("/v1/feed/rank", content=FEED_BODY, headers=headers)
    assert first.status_code == 200
    assert replay.status_code == 401


async def test_request_signed_too_far_in_the_past_is_rejected(signed_client: SignedIntelligenceClient) -> None:
    stale_headers = build_signed_headers("POST", "/v1/feed/rank", FEED_BODY, timestamp=int(time.time()) - 301)
    response = await signed_client.http_client.post("/v1/feed/rank", content=FEED_BODY, headers=stale_headers)
    assert response.status_code == 401


async def test_query_string_is_part_of_the_signature(signed_client: SignedIntelligenceClient) -> None:
    headers = build_signed_headers("GET", "/v1/experiments/checkout/metrics?variants=a,b", b"")
    tampered = await signed_client.http_client.get("/v1/experiments/checkout/metrics?variants=a,c", headers=headers)
    assert tampered.status_code == 401


async def test_oversized_body_is_rejected_before_parsing(signed_client: SignedIntelligenceClient) -> None:
    oversized = b"{" + b" " * (1_048_576 + 10) + b"}"
    response = await signed_client.http_client.post(
        "/v1/feed/rank", content=oversized, headers=build_signed_headers("POST", "/v1/feed/rank", oversized)
    )
    assert response.status_code == 413


async def test_validation_errors_do_not_echo_payload_values(signed_client: SignedIntelligenceClient) -> None:
    response = await signed_client.post(
        "/v1/feed/rank", {"viewer": {"userId": "has spaces not allowed"}, "candidates": []}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_request"
    assert "has spaces" not in response.text
    assert any("userId" in field for field in body["error"]["fields"])


async def test_rate_limit_returns_retry_after(intelligence_settings: IntelligenceSettings) -> None:
    limited_settings = intelligence_settings.model_copy(
        update={"rate_limit_requests_per_second": 0.01, "rate_limit_burst_size": 2}
    )
    application = create_application(limited_settings, InMemoryFeatureBackend(), start_background_tasks=False)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application), base_url="http://test") as client:
        statuses = [(await client.get("/health/live")).status_code for _ in range(3)]
        limited = await client.get("/health/live")
    assert statuses[:2] == [200, 200]
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) >= 1


def test_production_settings_refuse_weak_configuration() -> None:
    with pytest.raises(ValueError, match="SHARED_SECRET"):
        IntelligenceSettings(environment="production", shared_secret="short", redis_url="redis://x")
    with pytest.raises(ValueError, match="REDIS_URL"):
        IntelligenceSettings(environment="production", shared_secret="s" * 40, redis_url="")
    with pytest.raises(ValueError, match="nonce retention"):
        IntelligenceSettings(shared_secret="s" * 40, nonce_retention_seconds=300)
