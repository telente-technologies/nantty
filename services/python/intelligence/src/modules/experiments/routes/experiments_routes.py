from fastapi import APIRouter

from src.modules.experiments.controllers.experiments_controller import ExperimentsController
from src.modules.experiments.dtos.experiment_dto import ExperimentAssignmentResponse, ExperimentMetricsResponse


def build_experiments_router(controller: ExperimentsController) -> APIRouter:
    router = APIRouter(prefix="/v1/experiments", tags=["experiments"])
    router.add_api_route(
        "/assign", controller.assign_variants, methods=["POST"], response_model=ExperimentAssignmentResponse
    )
    router.add_api_route(
        "/{experiment_key}/metrics", controller.read_metrics, methods=["GET"], response_model=ExperimentMetricsResponse
    )
    return router
