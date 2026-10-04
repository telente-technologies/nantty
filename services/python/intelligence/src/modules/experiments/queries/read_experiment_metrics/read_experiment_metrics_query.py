from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query


@dataclass(frozen=True, slots=True)
class ReadExperimentMetricsQuery(Query):
    query_type: ClassVar[str] = "experiments.readExperimentMetrics"
    experiment_key: str
    variant_names: list[str]
