import asyncio
from typing import Protocol

from aio_pika import DeliveryMode, Message

from src.constants.rabbitmq_topology_constant import JOBS_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import SqsClientProtocol
from src.modules.trust_advisory.dtos.suspension_suggestion_dto import SuspensionSuggestion


class TrustAdvisoryPublisher(Protocol):
    delivers: bool

    async def publish_suspension_suggestion(self, suggestion: SuspensionSuggestion) -> None: ...


class NullTrustAdvisoryPublisher:
    delivers = False

    async def publish_suspension_suggestion(self, _suggestion: SuspensionSuggestion) -> None:
        return None


class SqsTrustAdvisoryPublisher:
    delivers = True

    def __init__(self, sqs_client: SqsClientProtocol, queue_url: str) -> None:
        self.sqs_client = sqs_client
        self.queue_url = queue_url

    async def publish_suspension_suggestion(self, suggestion: SuspensionSuggestion) -> None:
        body = suggestion.model_dump_json(by_alias=True)
        await asyncio.to_thread(
            self.sqs_client.send_message,
            QueueUrl=self.queue_url,
            MessageBody=body,
            MessageAttributes={"eventType": {"DataType": "String", "StringValue": "suspension.suggested"}},
        )


class AmqpTrustAdvisoryPublisher:
    delivers = True

    def __init__(self, channels: RabbitMqChannelProvider, queue_name: str) -> None:
        self.channels = channels
        self.queue_name = queue_name

    async def publish_suspension_suggestion(self, suggestion: SuspensionSuggestion) -> None:
        message = Message(
            body=suggestion.model_dump_json(by_alias=True).encode("utf-8"),
            message_id=suggestion.suggestion_id,
            type="suspension.suggested",
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
        )
        channel = await self.channels.channel_for_publishing()
        exchange = await channel.get_exchange(JOBS_EXCHANGE, ensure=False)
        await exchange.publish(message, routing_key=self.queue_name, mandatory=True)
