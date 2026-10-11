from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.model_registry.controllers.model_registry_controller import ModelRegistryController
from src.modules.model_registry.queries.describe_active_models.describe_active_models_handler import (
    DescribeActiveModelsHandler,
)
from src.modules.model_registry.routes.model_registry_routes import build_model_registry_router


class ModelRegistryModule:
    module_id = "model_registry"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(DescribeActiveModelsHandler(container.model_holder))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        return build_model_registry_router(
            ModelRegistryController(container.query_bus, container.settings.request_deadline_seconds)
        )
