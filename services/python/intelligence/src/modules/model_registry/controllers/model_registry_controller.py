from typing import Any

from src.modules.model_registry.queries.describe_active_models.describe_active_models_query import (
    DescribeActiveModelsQuery,
)
from src.utils.cqrs_util import QueryBus


class ModelRegistryController:
    def __init__(self, query_bus: QueryBus) -> None:
        self.query_bus = query_bus

    async def describe_active_models(self) -> dict[str, Any]:
        loaded_models: dict[str, Any] = await self.query_bus.execute(DescribeActiveModelsQuery())
        return {"models": loaded_models}
