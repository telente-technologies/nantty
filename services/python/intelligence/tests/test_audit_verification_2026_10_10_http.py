import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.types import Message

from src.app import create_application
from src.configs.settings_config import IntelligenceSettings
from src.container import build_identifier_hasher
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.errors.error_response_handler import respond_to_http_error
from src.events.event_envelope_dto import EventContext
from src.middlewares.signed_request_middleware import SignedRequestMiddleware
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest
from src.modules.events_ingestion.controllers.events_ingestion_controller import EventsIngestionController
from src.modules.experiments.controllers.experiments_controller import ExperimentsController
from src.modules.live_safety.services.rekognition_image_moderation_model_service import (
    ImageSourceNotAllowedError,
    RekognitionImageModerationModel,
)
from src.modules.model_registry.controllers.model_registry_controller import ModelRegistryController
from src.modules.moderation.queries.classify_image.classify_image_handler import ClassifyImageHandler
from src.modules.moderation.queries.classify_image.classify_image_query import ClassifyImageQuery
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace
from src.utils.request_signature_util import compute_request_signature_header_value
from src.utils.token_bucket_rate_limiter_util import MAXIMUM_TRACKED_CLIENTS, TokenBucketRateLimiter
from tests.conftest import TEST_SHARED_SECRET


def staging_settings(**overrides: object) -> IntelligenceSettings:
    values: dict[str, object] = {
        "environment": "staging",
        "shared_secret": "staging-shared-secret-that-is-long-enough-0",
        "model_signing_secret": "staging-model-signing-secret-long-enough-00",
        "redis_url": "redis://localhost:6379/0",
        "rabbitmq_url": "amqp://intelligence:secret@rabbit:5672/zudomart",
    }
    values.update(overrides)
    return IntelligenceSettings(**values)  # type: ignore[arg-type]


def test_sqs_event_bus_is_refused_outside_development() -> None:
    with pytest.raises(ValidationError, match="EVENT_BUS=sqs"):
        staging_settings(event_bus="sqs", domain_events_queue_url="https://sqs.local/queue")


@pytest.mark.parametrize(
    "overrides",
    [
        {"shared_secret": "local-only-intelligence-shared-secret-0123456789"},
        {"model_signing_secret": "change-me-model-signing-secret-000000000000"},
        {"id_hash_secret": "example-id-hash-secret-000000000000000000000"},
    ],
)
def test_known_placeholder_secrets_are_refused_outside_development(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        staging_settings(**overrides)


def test_short_id_hash_secret_is_refused_outside_development() -> None:
    with pytest.raises(ValidationError, match="ID_HASH_SECRET"):
        staging_settings(id_hash_secret="too-short")


def test_media_internal_url_and_token_must_be_paired() -> None:
    with pytest.raises(ValidationError, match="MEDIA_INTERNAL"):
        staging_settings(media_internal_url="http://media.internal")
    paired = staging_settings(media_internal_url="http://media.internal", media_internal_token="t" * 40)
    assert paired.media_internal_url == "http://media.internal"


def test_derived_pseudonym_key_is_reported_outside_development(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="intelligence.container"):
        build_identifier_hasher(staging_settings())
    assert "identifier_hash_key_derived_from_shared_secret" in caplog.messages


class NeverFinishingBus:
    async def execute(self, _message: object) -> Any:
        await asyncio.sleep(3600)


async def test_previously_unbounded_endpoints_now_have_a_deadline() -> None:
    bus: Any = NeverFinishingBus()
    calls = [
        EventsIngestionController(bus, 0.01).ingest_events(Any),  # type: ignore[arg-type]
        ModelRegistryController(bus, 0.01).describe_active_models(),
        ExperimentsController(bus, bus, 0.01).read_metrics("exp_a", "control,treatment"),
    ]
    for call in calls:
        with pytest.raises(HTTPException) as raised:
            _ = await asyncio.gather(call)
        assert raised.value.status_code == 503


def test_experiment_assignments_must_be_slugs() -> None:
    assert EventContext.model_validate({"experimentAssignments": {"exp_a": "treatment"}})
    for assignments in ({"exp:a": "x"}, {"exp_a": "x" * 65}, {"EXP": "a"}, {"exp_a": "a:b"}):
        with pytest.raises(ValidationError):
            EventContext.model_validate({"experimentAssignments": assignments})


async def test_http_error_headers_are_kept() -> None:
    response = await respond_to_http_error(
        None,  # type: ignore[arg-type]
        HTTPException(status_code=429, detail="rate_limited", headers={"retry-after": "3"}),
    )
    assert response.headers["retry-after"] == "3"


def test_models_route_declares_a_typed_response(intelligence_settings: IntelligenceSettings) -> None:
    application = create_application(intelligence_settings, InMemoryFeatureBackend(), start_background_tasks=False)
    response_schema = application.openapi()["paths"]["/v1/models"]["get"]["responses"]["200"]
    assert "ModelInventoryResponse" in json.dumps(response_schema)


def test_rate_limiter_evicts_one_client_instead_of_resetting_everyone() -> None:
    now = [0.0]
    limiter = TokenBucketRateLimiter(1.0, 1, lambda: now[0])
    assert limiter.try_consume_token("noisy")[0]
    assert not limiter.try_consume_token("noisy")[0]
    for index in range(MAXIMUM_TRACKED_CLIENTS - 1):
        limiter.try_consume_token(f"client-{index}")
    limiter.try_consume_token("noisy")
    limiter.try_consume_token("one-more")
    assert not limiter.try_consume_token("noisy")[0]


def build_middleware(application: Any, backend: InMemoryFeatureBackend) -> SignedRequestMiddleware:
    return SignedRequestMiddleware(
        application, [TEST_SHARED_SECRET], 300, 900, 1024, 4096, backend, OnlineFeatureKeyspace("intel")
    )


async def test_unsigned_request_is_refused_before_the_body_is_read() -> None:
    body_reads: list[int] = []
    sent: list[Message] = []

    async def receive() -> Message:
        body_reads.append(1)
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(message: Message) -> None:
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/v1/feed/rank", "headers": [], "query_string": b""}
    await build_middleware(None, InMemoryFeatureBackend())(scope, receive, send)
    assert body_reads == []
    assert sent[0]["status"] == 401


async def test_signature_over_the_raw_encoded_path_is_accepted() -> None:
    reached: list[str] = []

    async def application(scope: Any, _receive: Any, _send: Any) -> None:
        reached.append(scope["path"])

    timestamp, nonce, body = str(int(time.time())), "nonce-raw-path-000001", b""
    raw_path = "/v1/items/a%2Fb"
    signature = compute_request_signature_header_value(TEST_SHARED_SECRET, "GET", raw_path, timestamp, nonce, body)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/v1/items/a/b",
        "raw_path": raw_path.encode(),
        "query_string": b"",
        "headers": [
            (b"x-zudo-timestamp", timestamp.encode()),
            (b"x-zudo-nonce", nonce.encode()),
            (b"x-zudo-signature", signature.encode()),
        ],
    }

    async def receive() -> Message:
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(_message: Message) -> None:
        return None

    await build_middleware(application, InMemoryFeatureBackend())(scope, receive, send)
    assert reached == ["/v1/items/a/b"]


async def test_image_classification_runs_off_the_event_loop() -> None:
    calls: list[str] = []
    real_to_thread = asyncio.to_thread

    async def recording_to_thread(function: Any, *arguments: Any, **keywords: Any) -> Any:
        calls.append(getattr(function, "__name__", ""))
        return await real_to_thread(function, *arguments, **keywords)

    class Service:
        def classify_image(self, request: ImageModerationRequest) -> str:
            return request.media_id

    with patch("asyncio.to_thread", recording_to_thread):
        await ClassifyImageHandler(Service()).execute(  # type: ignore[arg-type]
            ClassifyImageQuery(ImageModerationRequest(media_id="m1"))
        )
    assert calls == ["classify_image"]


def test_rekognition_refuses_images_outside_the_media_bucket() -> None:
    class Client:
        def detect_moderation_labels(self, **_arguments: object) -> dict[str, object]:
            return {"ModerationLabels": []}

        def detect_faces(self, **_arguments: object) -> dict[str, object]:
            return {"FaceDetails": []}

    model = RekognitionImageModerationModel(Client(), 50.0, frozenset({"zudo-media"}))
    assert model.classify_image(ImageModerationRequest(media_id="m", image_url="s3://zudo-media/a.jpg")) == {}
    with pytest.raises(ImageSourceNotAllowedError):
        model.classify_image(ImageModerationRequest(media_id="m", image_url="s3://other-bucket/secret.jpg"))


def test_env_example_ships_a_single_worker_and_a_placeholder_secret() -> None:
    env_example = (Path(__file__).resolve().parents[1] / ".env.example").read_text()
    assert "INTELLIGENCE_SERVER_WORKERS=1" in env_example
    assert "local-only" in env_example
