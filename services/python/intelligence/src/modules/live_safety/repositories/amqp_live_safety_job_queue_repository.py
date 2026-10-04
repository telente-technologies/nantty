import asyncio
import logging
from functools import partial

from src.constants.rabbitmq_topology_constant import RETRY_EXCHANGE
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider, reconnect_delay_seconds
from src.modules.domain_events.repositories.amqp_domain_event_queue_repository import publish_to_exchange
from src.modules.live_safety.services.live_safety_scoring_service import LiveSafetyScoringService
from src.utils.amqp_message_settlement_util import settle_queue_message

live_queue_logger = logging.getLogger("intelligence.live_safety.queue")


class AmqpLiveSafetyJobQueueConsumer:
    def __init__(
        self, channels: RabbitMqChannelProvider, queue_name: str, scoring: LiveSafetyScoringService, prefetch: int = 10
    ) -> None:
        self.channels = channels
        self.queue_name = queue_name
        self.scoring = scoring
        self.prefetch = prefetch

    async def process_body(self, body: str) -> bool:
        return (await self.scoring.process_job_body(body)) != "rejected"

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
                live_queue_logger.exception("live_safety_consumer_interrupted", extra={"queue": self.queue_name})
            await asyncio.sleep(reconnect_delay_seconds(attempt))
            attempt += 1
