import asyncio
import logging
from functools import partial

from aio_pika import Message
from aio_pika.abc import AbstractExchange

from src.constants.rabbitmq_topology_constant import RETRY_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider, reconnect_delay_seconds
from src.modules.domain_events.services.domain_event_consumer_service import DomainEventConsumerService
from src.utils.amqp_message_settlement_util import settle_queue_message

queue_logger = logging.getLogger("intelligence.domain_events.queue")


async def publish_to_exchange(exchange: AbstractExchange, message: Message, routing_key: str) -> object:
    return await exchange.publish(message, routing_key=routing_key, mandatory=True)


class AmqpDomainEventQueueConsumer:
    def __init__(
        self,
        channels: RabbitMqChannelProvider,
        queue_name: str,
        consumer: DomainEventConsumerService,
        prefetch: int = 20,
    ) -> None:
        self.channels = channels
        self.queue_name = queue_name
        self.consumer = consumer
        self.prefetch = prefetch

    async def process_body(self, body: str) -> bool:
        return (await self.consumer.process_message_body(body)).status != "rejected"

    async def consume_until_closed(self) -> None:
        channel = await self.channels.open_channel()
        try:
            await channel.set_qos(prefetch_count=self.prefetch)
            queue = await channel.get_queue(self.queue_name, ensure=False)
            publish_retry = partial(publish_to_exchange, await channel.get_exchange(RETRY_EXCHANGE, ensure=False))
            async with queue.iterator() as messages:
                async for message in messages:
                    await settle_queue_message(message, self.queue_name, self.process_body, publish_retry)
        finally:
            if not channel.is_closed:
                await channel.close()

    async def run_consume_loop(self) -> None:
        attempt = 0
        while True:
            try:
                await self.consume_until_closed()
                attempt = 0
            except asyncio.CancelledError:
                raise
            except Exception:
                queue_logger.exception("domain_event_consumer_interrupted")
            await asyncio.sleep(reconnect_delay_seconds(attempt))
            attempt += 1
