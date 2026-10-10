import asyncio
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, Literal

from aio_pika import DeliveryMode, Message
from aio_pika.abc import AbstractIncomingMessage

from src.constants.rabbitmq_topology_constant import (
    ATTEMPT_HEADER,
    LAST_ERROR_HEADER,
    MAXIMUM_DELIVERY_ATTEMPTS,
    RETRY_TIER_NAMES,
)

settlement_logger = logging.getLogger("intelligence.queue")

type SettlementOutcome = Literal["acknowledged", "dead_lettered", "retry_scheduled", "requeued"]
type RetryPublisher = Callable[[Message, str], Awaitable[object]]
BROKER_HEADER_PREFIXES = ("x-death", "x-first-death", "x-last-death")
MAXIMUM_REQUEUE_WITHOUT_PUBLISH = MAXIMUM_DELIVERY_ATTEMPTS
REQUEUE_BACKOFF_SECONDS = 0.2

requeue_without_publish_counts: dict[str, int] = {}


def retry_queue_name(queue_name: str, tier_name: str) -> str:
    return f"{queue_name}.retry.{tier_name}"


def retry_tier_after_failed_attempt(failed_attempt: int) -> str | None:
    if failed_attempt < 1 or failed_attempt >= MAXIMUM_DELIVERY_ATTEMPTS:
        return None
    return RETRY_TIER_NAMES[min(failed_attempt - 1, len(RETRY_TIER_NAMES) - 1)]


def delivery_attempt_from_headers(headers: Mapping[str, Any] | None) -> int:
    value = (headers or {}).get(ATTEMPT_HEADER, 0)
    return value if isinstance(value, int) and value > 0 else 0


def headers_for_retry(headers: Mapping[str, Any] | None, failed_attempt: int, error: BaseException) -> dict[str, Any]:
    kept = {key: value for key, value in (headers or {}).items() if not key.startswith(BROKER_HEADER_PREFIXES)}
    return {**kept, ATTEMPT_HEADER: failed_attempt, LAST_ERROR_HEADER: f"{type(error).__name__}: {error}"[:256]}


def requeue_tracking_key(message: AbstractIncomingMessage) -> str:
    return str(message.message_id or message.body.decode("utf-8", errors="replace")[:256])


def forget_requeue_tracking(message: AbstractIncomingMessage) -> None:
    requeue_without_publish_counts.pop(requeue_tracking_key(message), None)


async def settle_queue_message(
    message: AbstractIncomingMessage,
    queue_name: str,
    process_body: Callable[[str], Awaitable[bool]],
    publish_retry: RetryPublisher,
) -> SettlementOutcome:
    try:
        processed = await process_body(message.body.decode("utf-8", errors="replace"))
    except Exception as error:
        return await retry_or_dead_letter(message, queue_name, error, publish_retry)
    if not processed:
        settlement_logger.warning("poison_message_dead_lettered", extra={"queue": queue_name})
        await message.reject(requeue=False)
        return "dead_lettered"
    await message.ack()
    return "acknowledged"


async def retry_or_dead_letter(
    message: AbstractIncomingMessage, queue_name: str, error: Exception, publish_retry: RetryPublisher
) -> SettlementOutcome:
    failed_attempt = delivery_attempt_from_headers(message.headers) + 1
    tier_name = retry_tier_after_failed_attempt(failed_attempt)
    if tier_name is None:
        settlement_logger.error("message_dead_lettered_after_last_attempt", extra={"queue": queue_name})
        forget_requeue_tracking(message)
        await message.reject(requeue=False)
        return "dead_lettered"
    retry = Message(
        body=message.body,
        headers=headers_for_retry(message.headers, failed_attempt, error),
        message_id=message.message_id,
        type=message.type,
        content_type=message.content_type,
        delivery_mode=DeliveryMode.PERSISTENT,
    )
    try:
        await publish_retry(retry, retry_queue_name(queue_name, tier_name))
    except Exception:
        settlement_logger.exception("retry_not_scheduled_message_requeued", extra={"queue": queue_name})
        tracking_key = requeue_tracking_key(message)
        requeues = requeue_without_publish_counts.get(tracking_key, 0) + 1
        requeue_without_publish_counts[tracking_key] = requeues
        if requeues >= MAXIMUM_REQUEUE_WITHOUT_PUBLISH:
            settlement_logger.error("message_dead_lettered_after_requeue_cap", extra={"queue": queue_name})
            forget_requeue_tracking(message)
            await message.reject(requeue=False)
            return "dead_lettered"
        await asyncio.sleep(REQUEUE_BACKOFF_SECONDS * requeues)
        await message.nack(requeue=True)
        return "requeued"
    settlement_logger.warning("message_retry_scheduled", extra={"queue": queue_name, "delay": tier_name})
    forget_requeue_tracking(message)
    await message.ack()
    return "retry_scheduled"
