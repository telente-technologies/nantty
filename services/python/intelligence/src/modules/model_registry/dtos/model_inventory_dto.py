from typing import Any

from pydantic import Field

from src.dtos.common_dto import ContractModel


class LoadedModelDescription(ContractModel):
    version: str
    created_at: str | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class ModelInventoryResponse(ContractModel):
    models: dict[str, LoadedModelDescription]
