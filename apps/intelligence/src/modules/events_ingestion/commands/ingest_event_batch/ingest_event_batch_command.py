from dataclasses import dataclass
from typing import ClassVar

from src.events.event_envelope_dto import EventBatchRequest
from src.interfaces.cqrs_interface import Command


@dataclass(frozen=True, slots=True)
class IngestEventBatchCommand(Command):
    command_type: ClassVar[str] = "eventsIngestion.ingestEventBatch"
    request: EventBatchRequest
