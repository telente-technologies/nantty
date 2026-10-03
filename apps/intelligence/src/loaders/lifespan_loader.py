import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI

from src.container import ApplicationContainer
from src.modules.domain_events.repositories.amqp_domain_event_queue_repository import AmqpDomainEventQueueConsumer
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import (
    SqsDomainEventQueuePoller,
    build_sqs_client,
)

lifespan_logger = logging.getLogger("intelligence.application")


def build_application_lifespan(
    container: ApplicationContainer, start_background_jobs: bool
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def application_lifespan(_application: FastAPI) -> AsyncIterator[None]:
        await container.model_holder.reload_changed_models()
        background_jobs: list[asyncio.Task[None]] = []
        if start_background_jobs:
            settings = container.settings
            background_jobs = [
                asyncio.create_task(
                    container.model_holder.run_periodic_reload_loop(settings.model_reload_interval_seconds)
                ),
                asyncio.create_task(
                    container.feature_log_sink.run_periodic_flush_loop(settings.feature_log_flush_interval_seconds)
                ),
            ]
            if container.rabbitmq_channels is not None:
                amqp_consumer = AmqpDomainEventQueueConsumer(
                    container.rabbitmq_channels,
                    settings.domain_events_queue,
                    container.domain_event_consumer_service,
                    settings.rabbitmq_prefetch,
                )
                background_jobs.append(asyncio.create_task(amqp_consumer.run_consume_loop()))
            elif settings.event_bus == "sqs" and settings.domain_events_queue_url:
                poller = SqsDomainEventQueuePoller(
                    build_sqs_client(settings),
                    settings.domain_events_queue_url,
                    container.domain_event_consumer_service,
                )
                background_jobs.append(asyncio.create_task(poller.run_poll_loop()))
        lifespan_logger.info("intelligence_started", extra={"environment": container.settings.environment})
        try:
            yield
        finally:
            for background_job in background_jobs:
                background_job.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await background_job
            await container.feature_log_sink.flush_buffered_rows()
            await container.feature_backend.close_backend_connections()
            if container.rabbitmq_channels is not None:
                await container.rabbitmq_channels.close()

    return application_lifespan
