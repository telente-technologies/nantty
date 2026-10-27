import inspect
import json
from datetime import datetime
from typing import Any, cast

import pytest
from aio_pika import Message
from aio_pika.abc import AbstractIncomingMessage

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.interfaces.feature_backend_interface import FeatureWriteOperation
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreMessage
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import (
    SqsDomainEventQueuePoller,
    backoff_delay_seconds,
)
from src.repositories.online_feature_keyspace_repository import (
    format_utc_day_bucket,
)
from src.utils import amqp_message_settlement_util
from src.utils.amqp_message_settlement_util import retry_or_dead_letter
from tests.modules.domain_events.test_domain_event_consumer import domain_event


class RecordingSqsClient:
    def __init__(self, bodies: list[str], receive_counts: list[int] | None = None) -> None:
        self.messages = [
            {
                "Body": body,
                "ReceiptHandle": f"handle_{index}",
                "MessageId": f"message_{index}",
                "Attributes": {"ApproximateReceiveCount": str((receive_counts or [1] * len(bodies))[index])},
            }
            for index, body in enumerate(bodies)
        ]
        self.deleted: list[str] = []
        self.sent: list[dict[str, Any]] = []

    def receive_message(self, **_kwargs: Any) -> dict[str, Any]:
        return {"Messages": self.messages}

    def delete_message(self, **kwargs: Any) -> dict[str, Any]:
        self.deleted.append(str(kwargs["ReceiptHandle"]))
        return {}

    def send_message(self, **kwargs: Any) -> dict[str, Any]:
        self.sent.append(dict(kwargs))
        return {}


def build_poller(
    client: RecordingSqsClient, container: ApplicationContainer, dlq: str = "http://dlq"
) -> SqsDomainEventQueuePoller:
    return SqsDomainEventQueuePoller(client, "http://queue", container.domain_event_consumer_service, 0, dlq, 3)


async def test_sqs_rejected_message_is_forwarded_to_dlq(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    client = RecordingSqsClient(["garbage"])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]
    assert [entry["QueueUrl"] for entry in client.sent] == ["http://dlq"]
    assert str(client.sent[0]["MessageBody"]) == "garbage"


async def test_sqs_failing_message_reaches_dlq_after_max_attempts(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def explode(_operations: list[FeatureWriteOperation]) -> None:
        raise RuntimeError("backend down")

    monkeypatch.setattr(feature_backend, "apply_write_operations", explode)
    monkeypatch.setattr(
        "src.modules.domain_events.repositories.sqs_domain_event_queue_repository.backoff_delay_seconds",
        lambda _attempt: 0.0,
    )
    body = domain_event("evt_dlq_1", "post.created", "author_dlq", reference_now, {"postId": "p_dlq"})
    client = RecordingSqsClient([body])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 0
    assert client.deleted == []
    assert await poller.poll_once() == 0
    assert client.deleted == []
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]
    assert len(client.sent) == 1


async def test_sqs_receive_count_attribute_counts_toward_dlq_limit(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def explode(_operations: list[FeatureWriteOperation]) -> None:
        raise RuntimeError("backend down")

    monkeypatch.setattr(feature_backend, "apply_write_operations", explode)
    monkeypatch.setattr(
        "src.modules.domain_events.repositories.sqs_domain_event_queue_repository.backoff_delay_seconds",
        lambda _attempt: 0.0,
    )
    body = domain_event("evt_dlq_2", "post.created", "author_dlq", reference_now, {"postId": "p_dlq"})
    client = RecordingSqsClient([body], [5])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert client.deleted == ["handle_0"]


class RaisingContentScorePublisher:
    delivers = True

    async def publish_content_score(self, _message: ContentScoreMessage) -> None:
        raise ConnectionError("broker unavailable")


async def test_side_effect_publish_failure_does_not_poison_domain_pipeline(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    service = application_container.content_scoring_service
    service.publisher = RaisingContentScorePublisher()
    body = domain_event(
        "evt_side_effect_1",
        "post.created",
        "author_side",
        reference_now,
        {"postId": "post_side", "text": "hello world"},
    )
    outcome = await application_container.domain_event_consumer_service.process_message_body(body)
    assert outcome.status == "processed"


class FakeIncomingMessage:
    def __init__(self, body: str, attempt: int = 0) -> None:
        self.body = body.encode()
        self.headers: dict[str, Any] = {"x-nantty-attempt": attempt} if attempt else {}
        self.message_id = "msg-regression"
        self.type = "post.created"
        self.content_type = "application/json"
        self.settlements: list[tuple[str, bool]] = []

    async def ack(self, multiple: bool = False) -> None:
        self.settlements.append(("ack", multiple))

    async def reject(self, requeue: bool = False) -> None:
        self.settlements.append(("reject", requeue))

    async def nack(self, multiple: bool = False, requeue: bool = True) -> None:
        self.settlements.append(("nack", requeue and not multiple))


class AlwaysFailingRetryPublisher:
    async def __call__(self, _message: Message, _routing_key: str) -> object:
        raise ConnectionError("retry exchange unavailable")


async def test_amqp_retry_publish_failures_are_capped_to_dlx(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(amqp_message_settlement_util, "REQUEUE_BACKOFF_SECONDS", 0.0)
    amqp_message_settlement_util.requeue_without_publish_counts.clear()
    message = FakeIncomingMessage("body")
    error = RuntimeError("processing failed")
    outcomes = [
        await retry_or_dead_letter(
            cast(AbstractIncomingMessage, message), "queue", error, AlwaysFailingRetryPublisher()
        )
        for _ in range(5)
    ]
    assert outcomes == ["requeued", "requeued", "requeued", "requeued", "dead_lettered"]
    assert message.settlements == [("nack", True)] * 4 + [("reject", False)]
    amqp_message_settlement_util.requeue_without_publish_counts.clear()


async def test_sqs_backoff_is_jittered_and_bounded() -> None:
    samples = [backoff_delay_seconds(1) for _ in range(50)]
    assert min(samples) >= 1.0
    assert max(samples) <= 3.0
    assert len(set(samples)) > 1
    assert backoff_delay_seconds(100) <= 30.0


def test_dlq_setting_exists_on_intelligence_settings(intelligence_settings: IntelligenceSettings) -> None:
    assert intelligence_settings.domain_events_dlq_queue_url == ""
    assert intelligence_settings.sqs_max_delivery_attempts >= 1


async def test_rejected_side_effect_still_ingests_event(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    reference_now: datetime,
) -> None:
    service = application_container.content_scoring_service
    service.publisher = RaisingContentScorePublisher()
    body = domain_event(
        "evt_side_effect_2",
        "post.created",
        "author_side_2",
        reference_now,
        {"postId": "post_side_2", "text": "hello world"},
    )
    outcome = await application_container.domain_event_consumer_service.process_message_body(body)
    assert outcome.status == "processed"
    keyspace = application_container.feature_store.keyspace
    counters = await feature_backend.read_hash_fields(
        [keyspace.behaviour_counter_key("author_side_2", format_utc_day_bucket(reference_now))]
    )
    assert counters[0].get("posts_created") == 1.0


def test_settlement_module_caps_requeues() -> None:
    source = inspect.getsource(amqp_message_settlement_util)
    assert "MAXIMUM_REQUEUE_WITHOUT_PUBLISH" in source
    assert "REQUEUE_BACKOFF_SECONDS" in source


async def test_poll_once_counts_toward_acknowledged_on_dlq_forward(
    application_container: ApplicationContainer,
) -> None:
    payload = json.dumps({"Message": "not used"})
    _ = payload
    client = RecordingSqsClient(["not json"])
    poller = build_poller(client, application_container)
    assert await poller.poll_once() == 1
    assert len(client.sent) == 1
