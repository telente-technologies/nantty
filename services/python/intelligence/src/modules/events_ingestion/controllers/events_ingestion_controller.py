from fastapi import HTTPException

from src.events.event_envelope_dto import EventBatchRequest, EventBatchResponse
from src.modules.events_ingestion.commands.ingest_event_batch.ingest_event_batch_command import (
    IngestEventBatchCommand,
)
from src.modules.events_ingestion.services.event_ingestion_service import EventStorageUnavailableError
from src.utils.cqrs_util import CommandBus
from src.utils.request_deadline_util import run_within_request_deadline


class EventsIngestionController:
    def __init__(self, command_bus: CommandBus, deadline_seconds: float) -> None:
        self.command_bus = command_bus
        self.deadline_seconds = deadline_seconds

    async def ingest_events(self, request: EventBatchRequest) -> EventBatchResponse:
        try:
            response: EventBatchResponse = await run_within_request_deadline(
                self.command_bus.execute(IngestEventBatchCommand(request)), self.deadline_seconds
            )
        except EventStorageUnavailableError as storage_error:
            raise HTTPException(status_code=503, detail="event_storage_unavailable") from storage_error
        return response
