from fastapi import FastAPI

from src.configs.settings_config import IntelligenceSettings, load_intelligence_settings
from src.container import build_application_container
from src.errors.error_response_handler import register_error_response_handlers
from src.interfaces.feature_backend_interface import FeatureBackend
from src.loaders.lifespan_loader import build_application_lifespan
from src.loaders.middleware_loader import load_security_middlewares
from src.loaders.module_loader import load_intelligence_modules
from src.loaders.telemetry_loader import configure_telemetry_when_collector_is_set
from src.loggers.structured_json_logger import configure_structured_logging


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
        title="Nantty Intelligence",
        version="1.0.0",
        lifespan=build_application_lifespan(container, start_background_tasks),
        docs_url="/docs" if documentation_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if documentation_enabled else None,
    )
    application.state.container = container
    load_intelligence_modules(application, container)
    register_error_response_handlers(application)
    load_security_middlewares(application, container)
    configure_telemetry_when_collector_is_set(application)
    return application
