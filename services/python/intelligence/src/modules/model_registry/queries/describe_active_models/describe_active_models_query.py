from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query


@dataclass(frozen=True, slots=True)
class DescribeActiveModelsQuery(Query):
    query_type: ClassVar[str] = "modelRegistry.describeActiveModels"
