from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Command
from src.modules.experiments.dtos.experiment_dto import ExperimentAssignmentRequest


@dataclass(frozen=True, slots=True)
class AssignExperimentVariantsCommand(Command):
    command_type: ClassVar[str] = "experiments.assignExperimentVariants"
    request: ExperimentAssignmentRequest
