from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.experiments.commands.assign_experiment_variants.assign_experiment_variants_handler import (
    AssignExperimentVariantsHandler,
)
from src.modules.experiments.controllers.experiments_controller import ExperimentsController
from src.modules.experiments.queries.read_experiment_metrics.read_experiment_metrics_handler import (
    ReadExperimentMetricsHandler,
)
from src.modules.experiments.routes.experiments_routes import build_experiments_router


class ExperimentsModule:
    module_id = "experiments"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.command_bus.register_handler(AssignExperimentVariantsHandler(container.experiment_service))
        container.query_bus.register_handler(ReadExperimentMetricsHandler(container.experiment_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = ExperimentsController(
            container.command_bus, container.query_bus, container.settings.request_deadline_seconds
        )
        return build_experiments_router(controller)
