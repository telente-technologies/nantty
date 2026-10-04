from typing import Protocol

from aio_pika import DeliveryMode, Message

from src.constants.rabbitmq_topology_constant import JOBS_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.live_safety.dtos.live_safety_dto import LiveSafetyScoreMessage


class LiveSafetyScorePublisher(Protocol):
    async def publish_live_safety_score(self, message: LiveSafetyScoreMessage) -> None: ...


class NullLiveSafetyScorePublisher:
    async def publish_live_safety_score(self, _message: LiveSafetyScoreMessage) -> None:
        return None


class AmqpLiveSafetyScorePublisher:
    def __init__(self, channels: RabbitMqChannelProvider, queue_name: str) -> None:
        self.channels = channels
        self.queue_name = queue_name

    async def publish_live_safety_score(self, message: LiveSafetyScoreMessage) -> None:
        amqp_message = Message(
            body=message.model_dump_json(by_alias=True).encode("utf-8"),
            message_id=message.score_id,
            type="liveSafetyScore.generated",
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
        )
        channel = await self.channels.channel_for_publishing()
        exchange = await channel.get_exchange(JOBS_EXCHANGE, ensure=False)
        await exchange.publish(amqp_message, routing_key=self.queue_name, mandatory=True)
