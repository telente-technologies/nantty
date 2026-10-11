from src.modules.model_registry.dtos.model_inventory_dto import ModelInventoryResponse
from src.modules.model_registry.queries.describe_active_models.describe_active_models_query import (
    DescribeActiveModelsQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ModelRegistryController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def describe_active_models(self) -> ModelInventoryResponse:
        loaded_models: dict[str, object] = await run_within_request_deadline(
            self.query_bus.execute(DescribeActiveModelsQuery()), self.deadline_seconds
        )
        return ModelInventoryResponse.model_validate({"models": loaded_models})
