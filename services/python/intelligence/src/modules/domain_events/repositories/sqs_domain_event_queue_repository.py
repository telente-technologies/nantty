import asyncio
import logging
import random
from typing import Any, Protocol

import boto3

from src.configs.settings_config import IntelligenceSettings
from src.integrations.aws_client_config import AWS_CLIENT_CONFIG
from src.modules.domain_events.services.domain_event_consumer_service import DomainEventConsumerService

queue_logger = logging.getLogger("intelligence.domain_events.queue")
RECEIVE_BATCH_SIZE = 10
PER_MESSAGE_PROCESSING_BUDGET_SECONDS = 30
BATCH_VISIBILITY_TIMEOUT_SECONDS = RECEIVE_BATCH_SIZE * PER_MESSAGE_PROCESSING_BUDGET_SECONDS
FAILURE_BACKOFF_SECONDS = 2.0
MAXIMUM_FAILURE_BACKOFF_SECONDS = 30.0


class SqsClientProtocol(Protocol):
    def receive_message(self, **kwargs: Any) -> dict[str, Any]:
        pass

    def delete_message(self, **kwargs: Any) -> dict[str, Any]:
        pass

    def send_message(self, **kwargs: Any) -> dict[str, Any]:
        pass


def build_sqs_client(settings: IntelligenceSettings) -> SqsClientProtocol:
    client: SqsClientProtocol = boto3.client(
        "sqs",
        region_name=settings.sqs_region,
        endpoint_url=settings.sqs_endpoint_url or None,
        aws_access_key_id=settings.sqs_access_key_id.get_secret_value() or None,
        aws_secret_access_key=settings.sqs_secret_access_key.get_secret_value() or None,
        config=AWS_CLIENT_CONFIG,
    )
    return client


def receive_count_of(message: dict[str, Any], tracked_attempts: dict[str, int]) -> int:
    attributes = message.get("Attributes")
    if isinstance(attributes, dict):
        raw = attributes.get("ApproximateReceiveCount")
        try:
            return max(int(str(raw)), 1)
        except TypeError, ValueError:
            pass
    key = str(message.get("MessageId") or message.get("ReceiptHandle") or message.get("Body"))
    return tracked_attempts.get(key, 1)


def track_attempt(message: dict[str, Any], tracked_attempts: dict[str, int]) -> int:
    key = str(message.get("MessageId") or message.get("ReceiptHandle") or message.get("Body"))
    tracked_attempts[key] = tracked_attempts.get(key, 0) + 1
    return tracked_attempts[key]


def forget_attempt(message: dict[str, Any], tracked_attempts: dict[str, int]) -> None:
    key = str(message.get("MessageId") or message.get("ReceiptHandle") or message.get("Body"))
    tracked_attempts.pop(key, None)


def backoff_delay_seconds(failed_attempt: int) -> float:
    grown = FAILURE_BACKOFF_SECONDS * (2.0 ** max(failed_attempt - 1, 0))
    return min(grown * (0.5 + random.random()), MAXIMUM_FAILURE_BACKOFF_SECONDS)


class SqsDomainEventQueuePoller:
    def __init__(
        self,
        sqs_client: SqsClientProtocol,
        queue_url: str,
        consumer: DomainEventConsumerService,
        wait_time_seconds: int = 10,
        dlq_queue_url: str = "",
        max_delivery_attempts: int = 5,
    ) -> None:
        self.sqs_client = sqs_client
        self.queue_url = queue_url
        self.consumer = consumer
        self.wait_time_seconds = wait_time_seconds
        self.dlq_queue_url = dlq_queue_url
        self.max_delivery_attempts = max_delivery_attempts
        self.tracked_attempts: dict[str, int] = {}

    async def forward_to_dlq(self, body: str) -> None:
        if not self.dlq_queue_url:
            return
        await asyncio.to_thread(
            self.sqs_client.send_message,
            QueueUrl=self.dlq_queue_url,
            MessageBody=body,
        )

    async def delete_message(self, message: dict[str, Any]) -> None:
        await asyncio.to_thread(
            self.sqs_client.delete_message, QueueUrl=self.queue_url, ReceiptHandle=message["ReceiptHandle"]
        )

    async def poll_once(self) -> int:
        response = await asyncio.to_thread(
            self.sqs_client.receive_message,
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=RECEIVE_BATCH_SIZE,
            WaitTimeSeconds=self.wait_time_seconds,
            VisibilityTimeout=BATCH_VISIBILITY_TIMEOUT_SECONDS,
            AttributeNames=["ApproximateReceiveCount"],
        )
        acknowledged = 0
        for message in response.get("Messages", []):
            body = message["Body"]
            try:
                outcome = await self.consumer.process_message_body(body)
            except Exception:
                queue_logger.exception("domain_event_processing_failed")
                attempts = max(
                    track_attempt(message, self.tracked_attempts),
                    receive_count_of(message, self.tracked_attempts),
                )
                if attempts >= self.max_delivery_attempts:
                    try:
                        await self.forward_to_dlq(body)
                    finally:
                        await self.delete_message(message)
                        forget_attempt(message, self.tracked_attempts)
                    acknowledged += 1
                else:
                    await asyncio.sleep(backoff_delay_seconds(attempts))
                continue
            if outcome.status == "rejected":
                queue_logger.warning("domain_event_rejected_forwarded_to_dlq")
                await self.forward_to_dlq(body)
                await self.delete_message(message)
                forget_attempt(message, self.tracked_attempts)
                acknowledged += 1
                continue
            await self.delete_message(message)
            forget_attempt(message, self.tracked_attempts)
            acknowledged += 1
        return acknowledged

    async def run_poll_loop(self) -> None:
        failed_attempt = 0
        while True:
            try:
                await self.poll_once()
                failed_attempt = 0
            except asyncio.CancelledError:
                raise
            except Exception:
                failed_attempt += 1
                queue_logger.exception("domain_event_poll_failed")
                await asyncio.sleep(backoff_delay_seconds(failed_attempt))
