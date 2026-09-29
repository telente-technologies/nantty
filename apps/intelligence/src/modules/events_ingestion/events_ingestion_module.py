from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.events_ingestion.commands.ingest_event_batch.ingest_event_batch_handler import (
    IngestEventBatchHandler,
)
from src.modules.events_ingestion.controllers.events_ingestion_controller import EventsIngestionController
from src.modules.events_ingestion.routes.events_ingestion_routes import build_events_ingestion_router


class EventsIngestionModule:
    module_id = "events_ingestion"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.command_bus.register_handler(IngestEventBatchHandler(container.event_ingestion_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        return build_events_ingestion_router(EventsIngestionController(container.command_bus))
