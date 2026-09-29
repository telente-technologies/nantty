import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.configs.settings_config import IntelligenceSettings, load_intelligence_settings
from app.core.application_container import ApplicationContainer, build_application_container
from app.core.structured_logging import configure_structured_logging
from app.middlewares.rate_limit_and_access_log_middleware import AccessLogMiddleware, RateLimitMiddleware
from app.middlewares.signed_request_middleware import SignedRequestMiddleware
from app.routes.audio_routes import audio_router
from app.routes.discovery_routes import discovery_router
from app.routes.operations_routes import operations_router
from app.routes.ranking_routes import ranking_router
from app.security.token_bucket_rate_limiter import TokenBucketRateLimiter
from app.stores.feature_backend_protocol import FeatureBackend

application_logger = logging.getLogger("intelligence.application")


def build_application_lifespan(
    container: ApplicationContainer, start_background_tasks: bool
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def application_lifespan(_application: FastAPI) -> AsyncIterator[None]:
        await container.model_holder.reload_changed_models()
        background_tasks: list[asyncio.Task[None]] = []
        if start_background_tasks:
            settings = container.settings
            background_tasks = [
                asyncio.create_task(
                    container.model_holder.run_periodic_reload_loop(settings.model_reload_interval_seconds)
                ),
                asyncio.create_task(
                    container.feature_log_sink.run_periodic_flush_loop(settings.feature_log_flush_interval_seconds)
                ),
            ]
        application_logger.info("intelligence_started", extra={"environment": container.settings.environment})
        try:
            yield
        finally:
            for task in background_tasks:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            await container.feature_log_sink.flush_buffered_rows()
            await container.feature_backend.close_backend_connections()

    return application_lifespan


async def respond_to_validation_error(_request: Request, error: Exception) -> JSONResponse:
    field_locations = []
    if isinstance(error, RequestValidationError):
        field_locations = [".".join(str(part) for part in item.get("loc", ())) for item in error.errors()][:20]
    return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "fields": field_locations}})


async def respond_to_http_error(_request: Request, error: Exception) -> JSONResponse:
    status_code = error.status_code if isinstance(error, HTTPException) else 500
    detail = error.detail if isinstance(error, HTTPException) else "internal_error"
    return JSONResponse(status_code=status_code, content={"error": {"code": str(detail)}})


async def respond_to_unexpected_error(_request: Request, error: Exception) -> JSONResponse:
    application_logger.error("unhandled_error", extra={"error_type": type(error).__name__})
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error"}})


def create_application(
    settings: IntelligenceSettings | None = None,
    feature_backend: FeatureBackend | None = None,
    start_background_tasks: bool = True,
) -> FastAPI:
    resolved_settings = settings or load_intelligence_settings()
    configure_structured_logging(resolved_settings.log_level)
    container = build_application_container(resolved_settings, feature_backend)
    documentation_enabled = resolved_settings.environment == "development"
    application = FastAPI(
        title="Zudomart Intelligence",
        version="1.0.0",
        lifespan=build_application_lifespan(container, start_background_tasks),
        docs_url="/docs" if documentation_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if documentation_enabled else None,
    )
    application.state.container = container
    application.include_router(operations_router)
    application.include_router(ranking_router)
    application.include_router(discovery_router)
    application.include_router(audio_router)
    application.add_exception_handler(RequestValidationError, respond_to_validation_error)
    application.add_exception_handler(HTTPException, respond_to_http_error)
    application.add_exception_handler(Exception, respond_to_unexpected_error)
    application.add_middleware(
        SignedRequestMiddleware,
        accepted_shared_secrets=[
            resolved_settings.shared_secret.get_secret_value(),
            resolved_settings.previous_shared_secret.get_secret_value(),
        ],
        maximum_clock_skew_seconds=resolved_settings.signature_max_clock_skew_seconds,
        nonce_retention_seconds=resolved_settings.nonce_retention_seconds,
        maximum_request_body_bytes=resolved_settings.max_request_body_bytes,
        maximum_event_batch_body_bytes=resolved_settings.max_event_batch_body_bytes,
        nonce_backend=container.feature_backend,
        keyspace=container.feature_store.keyspace,
    )
    application.add_middleware(
        RateLimitMiddleware,
        rate_limiter=TokenBucketRateLimiter(
            resolved_settings.rate_limit_requests_per_second, resolved_settings.rate_limit_burst_size
        ),
    )
    application.add_middleware(AccessLogMiddleware)
    return application
