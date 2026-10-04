import asyncio
import logging
from typing import Any, Protocol

import boto3

from src.configs.settings_config import IntelligenceSettings
from src.modules.domain_events.services.domain_event_consumer_service import DomainEventConsumerService

queue_logger = logging.getLogger("intelligence.domain_events.queue")
RECEIVE_BATCH_SIZE = 10
FAILURE_BACKOFF_SECONDS = 2.0


class SqsClientProtocol(Protocol):
    def receive_message(self, **kwargs: Any) -> dict[str, Any]: ...

    def delete_message(self, **kwargs: Any) -> dict[str, Any]: ...

    def send_message(self, **kwargs: Any) -> dict[str, Any]: ...


def build_sqs_client(settings: IntelligenceSettings) -> SqsClientProtocol:
    client: SqsClientProtocol = boto3.client(
        "sqs",
        region_name=settings.sqs_region,
        endpoint_url=settings.sqs_endpoint_url or None,
        aws_access_key_id=settings.sqs_access_key_id.get_secret_value() or None,
        aws_secret_access_key=settings.sqs_secret_access_key.get_secret_value() or None,
    )
    return client


class SqsDomainEventQueuePoller:
    def __init__(
        self,
        sqs_client: SqsClientProtocol,
        queue_url: str,
        consumer: DomainEventConsumerService,
        wait_time_seconds: int = 10,
    ) -> None:
        self.sqs_client = sqs_client
        self.queue_url = queue_url
        self.consumer = consumer
        self.wait_time_seconds = wait_time_seconds

    async def poll_once(self) -> int:
        response = await asyncio.to_thread(
            self.sqs_client.receive_message,
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=RECEIVE_BATCH_SIZE,
            WaitTimeSeconds=self.wait_time_seconds,
        )
        acknowledged = 0
        for message in response.get("Messages", []):
            try:
                await self.consumer.process_message_body(message["Body"])
            except Exception:
                queue_logger.exception("domain_event_processing_failed")
                continue
            await asyncio.to_thread(
                self.sqs_client.delete_message, QueueUrl=self.queue_url, ReceiptHandle=message["ReceiptHandle"]
            )
            acknowledged += 1
        return acknowledged

    async def run_poll_loop(self) -> None:
        while True:
            try:
                await self.poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                queue_logger.exception("domain_event_poll_failed")
                await asyncio.sleep(FAILURE_BACKOFF_SECONDS)
