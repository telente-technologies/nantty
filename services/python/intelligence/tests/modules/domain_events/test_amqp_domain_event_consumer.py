from datetime import datetime
from typing import Any, cast

from aio_pika import Message
from aio_pika.abc import AbstractIncomingMessage

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.domain_events.repositories.amqp_domain_event_queue_repository import AmqpDomainEventQueueConsumer
from src.utils.amqp_message_settlement_util import delivery_attempt_from_headers, settle_queue_message
from tests.modules.domain_events.test_domain_event_consumer import domain_event, product_viewed, read_topic_affinity

QUEUE = "intelligence-domain-events"


class FakeIncomingMessage:
    def __init__(self, body: str, attempt: int = 0) -> None:
        self.body = body.encode()
        self.headers: dict[str, Any] = {"x-nantty-attempt": attempt} if attempt else {}
        self.message_id = "msg-1"
        self.type = "post.created"
        self.content_type = "application/json"
        self.settlements: list[tuple[str, bool]] = []

    async def ack(self, multiple: bool = False) -> None:
        self.settlements.append(("ack", multiple))

    async def reject(self, requeue: bool = False) -> None:
        self.settlements.append(("reject", requeue))

    async def nack(self, multiple: bool = False, requeue: bool = True) -> None:
        self.settlements.append(("nack", requeue and not multiple))


class RecordingRetryPublisher:
    def __init__(self, fail: bool = False) -> None:
        self.published: list[tuple[Message, str]] = []
        self.fail = fail

    async def __call__(self, message: Message, routing_key: str) -> object:
        if self.fail:
            raise ConnectionError("broker unavailable")
        self.published.append((message, routing_key))
        return None


def build_consumer(container: ApplicationContainer) -> AmqpDomainEventQueueConsumer:
    return AmqpDomainEventQueueConsumer(
        RabbitMqChannelProvider("amqp://unused"), QUEUE, container.domain_event_consumer_service
    )


async def settle(
    container: ApplicationContainer, message: FakeIncomingMessage, retries: RecordingRetryPublisher
) -> str:
    consumer = build_consumer(container)
    return await settle_queue_message(cast(AbstractIncomingMessage, message), QUEUE, consumer.process_body, retries)


async def test_processed_and_duplicate_events_are_acknowledged_once_applied(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consent = domain_event(
        "evt_amqp_consent", "consent.granted", "user_amqp", reference_now, {"consentType": "personalization"}
    )
    consent_result = await settle(application_container, FakeIncomingMessage(consent), RecordingRetryPublisher())
    assert consent_result == "acknowledged"
    body = product_viewed("evt_amqp_1", "user_amqp", reference_now)
    first, second, retries = FakeIncomingMessage(body), FakeIncomingMessage(body), RecordingRetryPublisher()
    assert await settle(application_container, first, retries) == "acknowledged"
    assert await settle(application_container, second, retries) == "acknowledged"
    assert first.settlements == second.settlements == [("ack", False)]
    assert await read_topic_affinity(feature_backend, application_container, "user_amqp") == 1


async def test_poison_messages_go_to_the_dead_letter_queue(application_container: ApplicationContainer) -> None:
    message = FakeIncomingMessage("garbage")
    assert await settle(application_container, message, RecordingRetryPublisher()) == "dead_lettered"
    assert message.settlements == [("reject", False)]


async def test_failures_retry_with_backoff_then_dead_letter(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    async def explode(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("backend down")

    feature_backend.apply_write_operations = explode  # type: ignore[method-assign]
    body = domain_event("evt_amqp_2", "post.created", "author_amqp", reference_now, {"postId": "p"})
    retries = RecordingRetryPublisher()
    first = FakeIncomingMessage(body)
    assert await settle(application_container, first, retries) == "retry_scheduled"
    retry_message, routing_key = retries.published[0]
    assert routing_key == f"{QUEUE}.retry.30s"
    assert delivery_attempt_from_headers(retry_message.headers) == 1
    assert retry_message.message_id == "msg-1"
    assert first.settlements == [("ack", False)]
    last = FakeIncomingMessage(body, attempt=4)
    assert await settle(application_container, last, retries) == "dead_lettered"
    assert last.settlements == [("reject", False)]
    unavailable = FakeIncomingMessage(body)
    assert await settle(application_container, unavailable, RecordingRetryPublisher(fail=True)) == "requeued"
    assert unavailable.settlements == [("nack", True)]


async def test_withdrawn_consent_arriving_over_the_queue_stops_personalization(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    retries = RecordingRetryPublisher()
    withdraw = domain_event(
        "evt_amqp_c", "consent.withdrawn", "user_amqp_c", reference_now, {"consentType": "personalization"}
    )
    await settle(application_container, FakeIncomingMessage(withdraw), retries)
    viewed = product_viewed("evt_amqp_v", "user_amqp_c", reference_now)
    await settle(application_container, FakeIncomingMessage(viewed), retries)
    assert await read_topic_affinity(feature_backend, application_container, "user_amqp_c") == 0
