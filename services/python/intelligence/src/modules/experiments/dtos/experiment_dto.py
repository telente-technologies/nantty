from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier, UnitInterval

EXPERIMENT_KEY_PATTERN = r"^[a-z0-9_\-]{1,64}$"


class ExperimentVariant(ContractModel):
    name: str = Field(pattern=EXPERIMENT_KEY_PATTERN)
    weight: int = Field(ge=0, le=10_000)


class ExperimentDefinition(ContractModel):
    key: str = Field(pattern=EXPERIMENT_KEY_PATTERN)
    variants: list[ExperimentVariant] = Field(min_length=1, max_length=10)
    salt: str = Field(default="", max_length=64, pattern=r"^[A-Za-z0-9_\-]{0,64}$")
    traffic_allocation: UnitInterval = 1.0


class ExperimentAssignmentRequest(ContractModel):
    user_id: OpaqueIdentifier
    experiments: list[ExperimentDefinition] = Field(min_length=1, max_length=20)
    record_exposure: bool = True


class ExperimentAssignment(ContractModel):
    key: str
    variant: str | None
    bucket: int


class ExperimentAssignmentResponse(ContractModel):
    assignments: list[ExperimentAssignment]


class VariantMetrics(ContractModel):
    name: str
    distinct_users: int
    event_counts: dict[str, int]
    events_per_user: dict[str, float]


class ExperimentMetricsResponse(ContractModel):
    key: str
    variants: list[VariantMetrics]
