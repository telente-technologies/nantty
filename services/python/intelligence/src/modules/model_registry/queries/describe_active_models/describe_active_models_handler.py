from typing import Any

from src.interfaces.cqrs_interface import QueryHandler
from src.modules.model_registry.queries.describe_active_models.describe_active_models_query import (
    DescribeActiveModelsQuery,
)
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder


class DescribeActiveModelsHandler(QueryHandler[DescribeActiveModelsQuery, dict[str, dict[str, Any]]]):
    query_type = "modelRegistry.describeActiveModels"

    def __init__(self, model_holder: ActiveModelHolder) -> None:
        self.model_holder = model_holder

    async def execute(self, _query: DescribeActiveModelsQuery) -> dict[str, dict[str, Any]]:
        return self.model_holder.describe_loaded_models()
