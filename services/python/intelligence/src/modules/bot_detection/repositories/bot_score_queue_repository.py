import asyncio
from typing import Protocol

from aio_pika import DeliveryMode, Message

from src.constants.rabbitmq_topology_constant import JOBS_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.bot_detection.dtos.bot_detection_dto import BotScoreAdvisory
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import SqsClientProtocol

BOT_SCORE_MESSAGE_TYPE = "security.botScoreComputed"


class BotScorePublisher(Protocol):
    delivers: bool

    async def publish_bot_score(self, advisory: BotScoreAdvisory) -> None: ...


class NullBotScorePublisher:
    delivers = False

    async def publish_bot_score(self, _advisory: BotScoreAdvisory) -> None:
        return None


class AmqpBotScorePublisher:
    delivers = True

    def __init__(self, channels: RabbitMqChannelProvider, queue_name: str) -> None:
        self.channels = channels
        self.queue_name = queue_name

    async def publish_bot_score(self, advisory: BotScoreAdvisory) -> None:
        message = Message(
            body=advisory.model_dump_json(by_alias=True).encode("utf-8"),
            message_id=advisory.score_id,
            type=BOT_SCORE_MESSAGE_TYPE,
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
        )
        channel = await self.channels.channel_for_publishing()
        exchange = await channel.get_exchange(JOBS_EXCHANGE, ensure=False)
        await exchange.publish(message, routing_key=self.queue_name, mandatory=True)


class SqsBotScorePublisher:
    delivers = True

    def __init__(self, sqs_client: SqsClientProtocol, queue_url: str) -> None:
        self.sqs_client = sqs_client
        self.queue_url = queue_url

    async def publish_bot_score(self, advisory: BotScoreAdvisory) -> None:
        await asyncio.to_thread(
            self.sqs_client.send_message,
            QueueUrl=self.queue_url,
            MessageBody=advisory.model_dump_json(by_alias=True),
            MessageAttributes={"eventType": {"DataType": "String", "StringValue": BOT_SCORE_MESSAGE_TYPE}},
        )
