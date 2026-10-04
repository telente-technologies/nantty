from src.interfaces.cqrs_interface import QueryHandler
from src.modules.experiments.dtos.experiment_dto import ExperimentMetricsResponse
from src.modules.experiments.queries.read_experiment_metrics.read_experiment_metrics_query import (
    ReadExperimentMetricsQuery,
)
from src.modules.experiments.services.experiment_service import ExperimentService


class ReadExperimentMetricsHandler(QueryHandler[ReadExperimentMetricsQuery, ExperimentMetricsResponse]):
    query_type = "experiments.readExperimentMetrics"

    def __init__(self, experiment_service: ExperimentService) -> None:
        self.experiment_service = experiment_service

    async def execute(self, query: ReadExperimentMetricsQuery) -> ExperimentMetricsResponse:
        return await self.experiment_service.read_variant_metrics(query.experiment_key, query.variant_names)
