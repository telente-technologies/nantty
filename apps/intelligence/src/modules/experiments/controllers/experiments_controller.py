from typing import Annotated

from fastapi import HTTPException, Path, Query

from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.experiments.commands.assign_experiment_variants.assign_experiment_variants_command import (
    AssignExperimentVariantsCommand,
)
from src.modules.experiments.dtos.experiment_dto import (
    EXPERIMENT_KEY_PATTERN,
    ExperimentAssignmentRequest,
    ExperimentAssignmentResponse,
    ExperimentMetricsResponse,
)
from src.modules.experiments.queries.read_experiment_metrics.read_experiment_metrics_query import (
    ReadExperimentMetricsQuery,
)
from src.utils.cqrs_util import CommandBus, QueryBus
from src.utils.request_deadline_util import run_within_request_deadline

VARIANT_LIST_PATTERN = r"^[a-z0-9_\-]{1,64}(,[a-z0-9_\-]{1,64}){0,9}$"


class ExperimentsController:
    def __init__(self, command_bus: CommandBus, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.command_bus = command_bus
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def assign_variants(self, request: ExperimentAssignmentRequest) -> ExperimentAssignmentResponse:
        response: ExperimentAssignmentResponse = await run_within_request_deadline(
            self.command_bus.execute(AssignExperimentVariantsCommand(request)), self.deadline_seconds
        )
        return response

    async def read_metrics(
        self,
        experiment_key: Annotated[str, Path(pattern=EXPERIMENT_KEY_PATTERN)],
        variants: Annotated[str, Query(pattern=VARIANT_LIST_PATTERN)],
    ) -> ExperimentMetricsResponse:
        try:
            response: ExperimentMetricsResponse = await self.query_bus.execute(
                ReadExperimentMetricsQuery(experiment_key, variants.split(","))
            )
        except FeatureBackendUnavailableError as backend_error:
            raise HTTPException(status_code=503, detail="feature_store_unavailable") from backend_error
        return response
