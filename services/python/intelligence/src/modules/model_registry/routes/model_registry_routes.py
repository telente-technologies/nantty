from fastapi import APIRouter

from src.modules.model_registry.controllers.model_registry_controller import ModelRegistryController
from src.modules.model_registry.dtos.model_inventory_dto import ModelInventoryResponse


def build_model_registry_router(controller: ModelRegistryController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["models"])
    router.add_api_route(
        "/models", controller.describe_active_models, methods=["GET"], response_model=ModelInventoryResponse
    )
    return router
