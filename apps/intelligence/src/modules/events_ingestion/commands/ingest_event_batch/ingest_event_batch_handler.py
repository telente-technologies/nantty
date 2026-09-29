from src.events.event_envelope_dto import EventBatchResponse
from src.interfaces.cqrs_interface import CommandHandler
from src.modules.events_ingestion.commands.ingest_event_batch.ingest_event_batch_command import (
    IngestEventBatchCommand,
)
from src.modules.events_ingestion.services.event_ingestion_service import EventIngestionService


class IngestEventBatchHandler(CommandHandler[IngestEventBatchCommand, EventBatchResponse]):
    command_type = "eventsIngestion.ingestEventBatch"

    def __init__(self, event_ingestion_service: EventIngestionService) -> None:
        self.event_ingestion_service = event_ingestion_service

    async def execute(self, command: IngestEventBatchCommand) -> EventBatchResponse:
        return await self.event_ingestion_service.ingest_event_batch(command.request.events)
