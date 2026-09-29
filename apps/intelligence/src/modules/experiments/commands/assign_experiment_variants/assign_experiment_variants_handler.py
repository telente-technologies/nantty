from src.interfaces.cqrs_interface import CommandHandler
from src.modules.experiments.commands.assign_experiment_variants.assign_experiment_variants_command import (
    AssignExperimentVariantsCommand,
)
from src.modules.experiments.dtos.experiment_dto import ExperimentAssignmentResponse
from src.modules.experiments.services.experiment_service import ExperimentService


class AssignExperimentVariantsHandler(CommandHandler[AssignExperimentVariantsCommand, ExperimentAssignmentResponse]):
    command_type = "experiments.assignExperimentVariants"

    def __init__(self, experiment_service: ExperimentService) -> None:
        self.experiment_service = experiment_service

    async def execute(self, command: AssignExperimentVariantsCommand) -> ExperimentAssignmentResponse:
        return await self.experiment_service.assign_variants(command.request)
