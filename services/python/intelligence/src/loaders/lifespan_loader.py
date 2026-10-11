import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI

from src.container import ApplicationContainer
from src.integrations.dataset_storage_integration import build_dataset_storage_location
from src.jobs.compact_datasets_job import run_periodic_retention_loop
from src.jobs.erase_personal_data_job import run_periodic_erasure_loop
from src.modules.domain_events.repositories.amqp_domain_event_queue_repository import AmqpDomainEventQueueConsumer
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import (
    SqsDomainEventQueuePoller,
    build_sqs_client,
)
from src.modules.live_safety.live_safety_module import start_live_safety_consumers

lifespan_logger = logging.getLogger("intelligence.application")


def log_background_task_exit(task: asyncio.Task[None]) -> None:
    if task.cancelled():
        return
    if (error := task.exception()) is not None:
        lifespan_logger.exception("background_job_died", extra={"error_type": type(error).__name__})


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
                    container.model_holder.run_periodic_reload_loop(settings.model_reload_interval_seconds),
                    name="model_reload",
                ),
                asyncio.create_task(
                    container.feature_log_sink.run_periodic_flush_loop(settings.feature_log_flush_interval_seconds),
                    name="feature_log_flush",
                ),
                asyncio.create_task(
                    run_periodic_retention_loop(
                        build_dataset_storage_location(settings),
                        settings.dataset_retention_days,
                        settings.dataset_retention_interval_seconds,
                    ),
                    name="dataset_retention",
                ),
                asyncio.create_task(
                    run_periodic_erasure_loop(
                        build_dataset_storage_location(settings),
                        container.feature_backend,
                        container.feature_store.keyspace,
                        settings.dataset_retention_days,
                        settings.dataset_erasure_interval_seconds,
                    ),
                    name="dataset_erasure",
                ),
            ]
            if container.rabbitmq_channels is not None:
                amqp_consumer = AmqpDomainEventQueueConsumer(
                    container.rabbitmq_channels,
                    settings.domain_events_queue,
                    container.domain_event_consumer_service,
                    settings.rabbitmq_prefetch,
                )
                background_jobs.append(asyncio.create_task(amqp_consumer.run_consume_loop(), name="domain_events_amqp"))
                background_jobs += start_live_safety_consumers(
                    settings, container.rabbitmq_channels, container.live_safety_scoring_service
                )
            elif settings.event_bus == "sqs" and settings.domain_events_queue_url:
                poller = SqsDomainEventQueuePoller(
                    build_sqs_client(settings),
                    settings.domain_events_queue_url,
                    container.domain_event_consumer_service,
                    dlq_queue_url=settings.domain_events_dlq_queue_url,
                    max_delivery_attempts=settings.sqs_max_delivery_attempts,
                )
                background_jobs.append(asyncio.create_task(poller.run_poll_loop(), name="domain_events_sqs"))
            for background_job in background_jobs:
                background_job.add_done_callback(log_background_task_exit)
                container.background_job_monitor.track(background_job.get_name(), background_job)
        lifespan_logger.info("intelligence_started", extra={"environment": container.settings.environment})
        try:
            yield
        finally:
            container.background_job_monitor.forget_all()
            for background_job in background_jobs:
                background_job.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await background_job
            with contextlib.suppress(Exception):
                await container.feature_log_sink.flush_buffered_rows()
            with contextlib.suppress(Exception):
                await container.feature_backend.close_backend_connections()
            if container.rabbitmq_channels is not None:
                with contextlib.suppress(Exception):
                    await container.rabbitmq_channels.close()

    return application_lifespan
