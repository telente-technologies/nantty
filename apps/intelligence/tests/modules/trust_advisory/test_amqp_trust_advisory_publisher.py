import json
from datetime import UTC, datetime
from typing import Any, cast

from aio_pika import DeliveryMode, Message

from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.trust_advisory.dtos.suspension_suggestion_dto import SuspensionEvidence, SuspensionSuggestion
from src.modules.trust_advisory.repositories.trust_advisory_queue_repository import AmqpTrustAdvisoryPublisher


class FakeExchange:
    def __init__(self) -> None:
        self.published: list[tuple[Message, str, bool]] = []

    async def publish(self, message: Message, routing_key: str, *, mandatory: bool = True) -> None:
        self.published.append((message, routing_key, mandatory))


class FakeChannel:
    def __init__(self) -> None:
        self.exchanges: dict[str, FakeExchange] = {}

    async def get_exchange(self, name: str, *, ensure: bool = True) -> FakeExchange:
        assert ensure is False
        return self.exchanges.setdefault(name, FakeExchange())


class FakeChannelProvider:
    def __init__(self) -> None:
        self.channel = FakeChannel()

    async def channel_for_publishing(self) -> Any:
        return self.channel


async def test_suggestions_are_persistent_jobs_routed_to_the_trust_advisory_queue() -> None:
    provider = FakeChannelProvider()
    publisher = AmqpTrustAdvisoryPublisher(cast(RabbitMqChannelProvider, provider), "intelligence-trust-advisory")
    suggestion = SuspensionSuggestion(
        suggestion_id="sg-1",
        subject_id="acc-1",
        source="chat_spam",
        score=0.93,
        evidence=[SuspensionEvidence(code="burst_dm", weight=0.7)],
        generated_at=datetime(2026, 10, 3, tzinfo=UTC),
    )
    await publisher.publish_suspension_suggestion(suggestion)
    message, routing_key, mandatory = provider.channel.exchanges["zudomart.jobs"].published[0]
    assert (routing_key, mandatory) == ("intelligence-trust-advisory", True)
    assert message.message_id == "sg-1"
    assert message.delivery_mode == DeliveryMode.PERSISTENT
    body = json.loads(message.body)
    assert body["advisoryOnly"] is True
    assert body["suggestionId"] == "sg-1"
