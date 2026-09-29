from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models.event_envelope_model import EventBatchRequest, EventBatchResponse
from app.routes.route_dependencies import ContainerDependency
from app.services.event_ingestion_service import EventStorageUnavailableError

operations_router = APIRouter(tags=["operations"])


@operations_router.get("/health/live")
async def report_liveness_route() -> dict[str, str]:
    return {"status": "ok"}


@operations_router.get("/health/ready")
async def report_readiness_route(container: ContainerDependency) -> JSONResponse:
    feature_store_reachable = await container.feature_backend.check_backend_is_reachable()
    return JSONResponse(
        status_code=200 if feature_store_reachable else 503,
        content={"status": "ready" if feature_store_reachable else "degraded"},
    )


@operations_router.post("/v1/events", response_model=EventBatchResponse)
async def ingest_events_route(request: EventBatchRequest, container: ContainerDependency) -> EventBatchResponse:
    try:
        return await container.event_ingestion_service.ingest_event_batch(request.events)
    except EventStorageUnavailableError as storage_error:
        raise HTTPException(status_code=503, detail="event_storage_unavailable") from storage_error


@operations_router.get("/v1/models")
async def describe_active_models_route(container: ContainerDependency) -> dict[str, Any]:
    return {"models": container.model_holder.describe_loaded_models()}
