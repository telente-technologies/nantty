from typing import Protocol

from aio_pika import DeliveryMode, Message

from src.constants.rabbitmq_topology_constant import DOMAIN_EVENTS_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.content_scoring.dtos.sensitivity_advisory_dto import SensitivityAdvisedEvent


class SensitivityAdvisoryPublisher(Protocol):
    delivers: bool

    async def publish_sensitivity_advisory(self, event: SensitivityAdvisedEvent) -> None:
        pass


class NullSensitivityAdvisoryPublisher:
    delivers = False

    async def publish_sensitivity_advisory(self, _event: SensitivityAdvisedEvent) -> None:
        return None


class AmqpSensitivityAdvisoryPublisher:
    delivers = True

    def __init__(self, channels: RabbitMqChannelProvider) -> None:
        self.channels = channels

    async def publish_sensitivity_advisory(self, event: SensitivityAdvisedEvent) -> None:
        amqp_message = Message(
            body=event.model_dump_json(by_alias=True).encode("utf-8"),
            message_id=event.id,
            correlation_id=event.id,
            type=event.type,
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            headers={"x-zudomart-subject": event.subject, "x-zudomart-schema": "envelope.v1"},
        )
        channel = await self.channels.channel_for_publishing()
        exchange = await channel.get_exchange(DOMAIN_EVENTS_EXCHANGE, ensure=False)
        await exchange.publish(amqp_message, routing_key=event.type, mandatory=True)
