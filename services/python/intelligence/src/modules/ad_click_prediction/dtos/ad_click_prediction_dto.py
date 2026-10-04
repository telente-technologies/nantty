from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata, ViewerContext
from src.modules.ads.dtos.ad_selection_dto import AdCandidate, AdPlacement
from src.validators.common_field_validator import OpaqueIdentifier, UnitInterval


class AdClickPredictionRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    placement: AdPlacement
    viewer: ViewerContext
    candidates: list[AdCandidate] = Field(min_length=1, max_length=300)
    now: AwareDatetime | None = None


class AdClickPrediction(ContractModel):
    ad_id: OpaqueIdentifier
    predicted_click_rate: UnitInterval


class AdClickPredictionResponse(ContractModel):
    predictions: list[AdClickPrediction]
    personalized: bool
    metadata: RankingResponseMetadata
