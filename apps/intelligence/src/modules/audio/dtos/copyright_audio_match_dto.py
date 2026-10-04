from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier


class CopyrightAudioMatchRequest(ContractModel):
    claim_id: OpaqueIdentifier
    reference_media_id: OpaqueIdentifier
    target_media_ids: list[OpaqueIdentifier] = Field(min_length=1, max_length=10)


class CopyrightAudioMatch(ContractModel):
    target_media_id: str
    reference_media_id: str
    confidence_percent: int = Field(ge=0, le=100)
    target_start_seconds: float = Field(ge=0)
    target_end_seconds: float = Field(ge=0)
    reference_start_seconds: float = Field(ge=0)


class CopyrightAudioMatchResponse(ContractModel):
    claim_id: str
    advisory: Literal[True] = True
    fingerprint_source: str
    available: bool
    matches: list[CopyrightAudioMatch]
