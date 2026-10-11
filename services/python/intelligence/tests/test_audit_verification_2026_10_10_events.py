import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.controllers.health_controller import HealthController
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.databases.redis_feature_database import SCRIPT_KEY_CHUNK_SIZE, RedisFeatureBackend
from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.event_envelope_dto import intelligence_event_type_adapter
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.interfaces.feature_backend_interface import HashFieldIncrement, KeyExpiry
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import (
    BATCH_VISIBILITY_TIMEOUT_SECONDS,
    SqsDomainEventQueuePoller,
)
from src.modules.events_ingestion.services.event_feature_update_service import build_advertising_operations
from src.modules.live_safety.services.transcribe_batch_transcription_service import TranscribeBatchTranscriber
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace
from src.services.background_job_monitor_service import BackgroundJobMonitor
from src.utils.amqp_message_settlement_util import MAXIMUM_QUEUE_MESSAGE_BYTES, settle_queue_message
from tests.conftest import TEST_SHARED_SECRET, build_event
from tests.modules.domain_events.test_domain_event_consumer import domain_event
from tests.modules.live_safety.test_live_safety_scoring_service import build_scoring, frame_job_body


class AlwaysReachableBackend(InMemoryFeatureBackend):
    async def check_backend_is_reachable(self) -> bool:
        return True


async def test_readiness_fails_when_a_background_job_has_died() -> None:
    async def crash() -> None:
        raise RuntimeError("consumer died")

    monitor = BackgroundJobMonitor()
    task = asyncio.create_task(crash())
    await asyncio.gather(task, return_exceptions=True)
    monitor.track("domain_events_amqp", task)
    response = await HealthController(AlwaysReachableBackend(), monitor).report_readiness()
    assert response.status_code == 503
    healthy = await HealthController(AlwaysReachableBackend(), BackgroundJobMonitor()).report_readiness()
    assert healthy.status_code == 200


class FakeIncomingMessage:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.headers: dict[str, Any] = {}
        self.message_id = "m1"
        self.type = None
        self.content_type = "application/json"
        self.settled: list[str] = []

    async def reject(self, requeue: bool = False) -> None:
        self.settled.append(f"reject:{requeue}")

    async def ack(self) -> None:
        self.settled.append("ack")

    async def nack(self, requeue: bool = True) -> None:
        self.settled.append(f"nack:{requeue}")


async def test_oversized_queue_message_is_dead_lettered_without_parsing() -> None:
    parsed: list[str] = []

    async def process(body: str) -> bool:
        parsed.append(body)
        return True

    async def publish_retry(_message: object, _queue: str) -> None:
        return None

    message = FakeIncomingMessage(b"x" * (MAXIMUM_QUEUE_MESSAGE_BYTES + 1))
    outcome = await settle_queue_message(message, "q", process, publish_retry)  # type: ignore[arg-type]
    assert outcome == "dead_lettered"
    assert message.settled == ["reject:False"]
    assert parsed == []


async def test_domain_claim_ttl_follows_the_configured_dedup_retention(tmp_path: Path, reference_now: datetime) -> None:
    clock = [1_000_000.0]
    backend = InMemoryFeatureBackend(lambda: clock[0])
    settings = IntelligenceSettings(
        environment="test",
        shared_secret=TEST_SHARED_SECRET,
        event_storage_uri=str(tmp_path / "data"),
        model_registry_path=tmp_path / "registry",
        event_deduplication_retention_seconds=3600,
    )
    consumer = build_application_container(settings, backend).domain_event_consumer_service
    body = domain_event("evt_ttl", "post.liked", "user_1", reference_now, {"postId": "p1", "authorId": "a1"})
    assert (await consumer.process_message_body(body)).status == "processed"
    assert (await consumer.process_message_body(body)).status == "duplicate"
    clock[0] += 3601
    assert (await consumer.process_message_body(body)).status == "processed"


async def test_producer_event_id_cannot_suppress_a_domain_event(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    ingested = await application_container.event_ingestion_service.ingest_event_batch(
        [build_event("domain:evt_target", "post_liked", "user_1", reference_now, {"postId": "p1", "authorId": "a1"})],
        reference_now,
    )
    assert ingested.accepted == 1
    body = domain_event("evt_target", "post.liked", "user_2", reference_now, {"postId": "p1", "authorId": "a1"})
    outcome = await application_container.domain_event_consumer_service.process_message_body(body)
    assert outcome.status == "processed"


def test_comment_without_comment_id_keeps_the_envelope_id() -> None:
    def envelope(event_id: str) -> dict[str, Any]:
        return {
            "id": event_id,
            "type": "comment.created",
            "schemaVersion": 1,
            "occurredAt": "2026-10-10T10:00:00Z",
            "data": {"authorId": "u1", "postId": "p1", "postAuthorId": "a1"},
        }

    assert normalize_contract_envelope(envelope("evt_1"))["eventId"] == "evt_1"
    assert normalize_contract_envelope(envelope("evt_2"))["eventId"] == "evt_2"


def test_unsupported_envelope_schema_version_is_not_flattened() -> None:
    body = {"id": "e", "type": "post.liked", "schemaVersion": 2, "data": {"postId": "p"}}
    assert normalize_contract_envelope(body) is body


async def test_sqs_batch_receive_reserves_visibility_for_the_whole_batch(
    application_container: ApplicationContainer,
) -> None:
    received: list[dict[str, Any]] = []

    class Client:
        def receive_message(self, **arguments: Any) -> dict[str, Any]:
            received.append(arguments)
            return {"Messages": []}

        def delete_message(self, **_arguments: Any) -> dict[str, Any]:
            return {}

        def send_message(self, **_arguments: Any) -> dict[str, Any]:
            return {}

    poller = SqsDomainEventQueuePoller(Client(), "http://q", application_container.domain_event_consumer_service, 0)
    await poller.poll_once()
    assert received[0]["VisibilityTimeout"] == BATCH_VISIBILITY_TIMEOUT_SECONDS
    assert received[0]["MaxNumberOfMessages"] * 30 <= BATCH_VISIBILITY_TIMEOUT_SECONDS


async def test_concurrent_publishers_share_one_channel() -> None:
    opened: list[int] = []

    class Channel:
        is_closed = False

    provider = RabbitMqChannelProvider("amqp://unused")

    async def open_channel() -> Any:
        opened.append(1)
        await asyncio.sleep(0.01)
        return Channel()

    provider.open_channel = open_channel  # type: ignore[method-assign]
    channels = await asyncio.gather(*(provider.channel_for_publishing() for _ in range(5)))
    assert len(opened) == 1
    assert len({id(channel) for channel in channels}) == 1


async def test_in_memory_backend_evicts_expired_claims() -> None:
    clock = [0.0]
    backend = InMemoryFeatureBackend(lambda: clock[0])
    await backend.claim_keys_if_absent([f"k{index}" for index in range(12_000)], 10)
    clock[0] += 11
    await backend.claim_keys_if_absent(["fresh"], 10)
    assert len(backend._claimed_keys) == 1


async def test_events_from_a_deleted_account_are_not_ingested(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.purge_service.purge_account("erased_user")
    response = await application_container.event_ingestion_service.ingest_event_batch(
        [
            build_event(
                "evt_after_erasure", "post_liked", "erased_user", reference_now, {"postId": "p1", "authorId": "a1"}
            )
        ],
        reference_now,
    )
    assert response.accepted == 0
    assert [item.reason for item in response.rejected] == ["account_deleted"]


async def test_sorted_set_reads_are_chunked() -> None:
    executed_sizes: list[int] = []

    class Pipeline:
        def __init__(self) -> None:
            self.size = 0

        async def __aenter__(self) -> Pipeline:
            return self

        async def __aexit__(self, *_arguments: object) -> None:
            return None

        def zrevrange(self, *_arguments: object, **_keywords: object) -> None:
            self.size += 1

        async def execute(self) -> list[list[tuple[str, float]]]:
            executed_sizes.append(self.size)
            return [[] for _ in range(self.size)]

    class Client:
        def pipeline(self, **_options: object) -> Pipeline:
            return Pipeline()

    backend = RedisFeatureBackend("redis://localhost:1/0", 0.5)
    backend._redis_client = Client()  # type: ignore[assignment]
    rows = await backend.read_sorted_set_highest_members([f"k{index}" for index in range(2500)], 5)
    assert len(rows) == 2500
    assert max(executed_sizes) <= SCRIPT_KEY_CHUNK_SIZE
    assert IntelligenceSettings(environment="test", shared_secret="x").redis_socket_timeout_seconds >= 0.5


def test_ad_statistics_keys_get_a_ttl(reference_now: datetime) -> None:
    event = intelligence_event_type_adapter.validate_python(
        build_event(
            "evt_ad",
            "ad_click",
            "viewer_1",
            reference_now,
            {"adId": "ad_1", "campaignId": "c1", "auctionId": "auction_1"},
        )
    )
    operations = build_advertising_operations(event, OnlineFeatureKeyspace("intel"))
    ad_key = OnlineFeatureKeyspace("intel").ad_statistics_key("ad_1")
    assert any(isinstance(item, HashFieldIncrement) and item.key == ad_key for item in operations)
    assert any(isinstance(item, KeyExpiry) and item.key == ad_key for item in operations)


async def test_transcription_retry_reuses_the_existing_job() -> None:
    class AwsConflictError(Exception):
        response: dict[str, Any] = {"Error": {"Code": "ConflictException"}}  # noqa: RUF012

    class Transcribe:
        def start_transcription_job(self, **_arguments: Any) -> dict[str, Any]:
            raise AwsConflictError("job exists")

        def get_transcription_job(self, **_arguments: Any) -> dict[str, Any]:
            return {"TranscriptionJob": {"TranscriptionJobStatus": "COMPLETED"}}

    class Body:
        def read(self) -> bytes:
            return json.dumps({"results": {"transcripts": [{"transcript": "hello there"}]}}).encode()

    class Objects:
        def get_object(self, **_arguments: Any) -> dict[str, Any]:
            return {"Body": Body()}

    transcriber = TranscribeBatchTranscriber(Transcribe(), Objects(), "out", poll_seconds=0.0, timeout_seconds=1.0)
    assert await transcriber.transcribe_segment("seg-1", "bucket", "a.m4a") == "hello there"


async def test_live_safety_scoring_errors_retry_instead_of_dead_lettering(monkeypatch: pytest.MonkeyPatch) -> None:
    service, _publisher = build_scoring()

    async def failing_score(*_arguments: Any, **_keywords: Any) -> str:
        raise ValueError("scoring bug")

    monkeypatch.setattr(service, "score_frame", failing_score)
    with pytest.raises(ValueError, match="scoring bug"):
        await service.process_job_body(frame_job_body())
    assert await service.process_job_body("{") == "rejected"


async def test_unknown_live_safety_job_types_are_logged(caplog: pytest.LogCaptureFixture) -> None:
    service, _publisher = build_scoring()
    with caplog.at_level(logging.WARNING, logger="intelligence.live_safety"):
        outcome = await service.process_job_body(json.dumps({"type": "liveSticker.created", "payload": {}}))
    assert outcome == "skipped"
    assert "live_safety_job_type_skipped" in caplog.messages
