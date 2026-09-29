from fastapi import APIRouter

from src.events.event_envelope_dto import EventBatchResponse
from src.modules.events_ingestion.controllers.events_ingestion_controller import EventsIngestionController


def build_events_ingestion_router(controller: EventsIngestionController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["events"])
    router.add_api_route("/events", controller.ingest_events, methods=["POST"], response_model=EventBatchResponse)
    return router
