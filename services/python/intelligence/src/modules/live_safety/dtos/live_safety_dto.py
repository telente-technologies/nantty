from datetime import datetime
from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier

LiveSafetySignalKind = Literal["frame", "transcript"]
LiveSafetySuggestedAction = Literal["allow", "review", "hold"]
ObjectKey = str


class LiveFrameCapturedJob(ContractModel):
    frame_id: OpaqueIdentifier
    live_id: OpaqueIdentifier
    host_id: OpaqueIdentifier
    bucket: str = Field(min_length=3, max_length=63)
    frame_ref: ObjectKey = Field(min_length=1, max_length=512)
    captured_at: datetime
    boosted: bool = False
    hold_active: bool = False


class LiveAudioSegmentJob(ContractModel):
    segment_id: OpaqueIdentifier
    live_id: OpaqueIdentifier
    host_id: OpaqueIdentifier
    bucket: str = Field(min_length=3, max_length=63)
    segment_ref: ObjectKey = Field(min_length=1, max_length=512)
    captured_at: datetime


class DetectedModerationLabel(ContractModel):
    name: str
    parent_name: str = ""
    confidence: float = Field(ge=0.0, le=1.0)


class LiveSafetyCategory(ContractModel):
    category: str
    confidence: float = Field(ge=0.0, le=1.0)


class CsamHashMatch(ContractModel):
    provider: str
    match_reference: str


class LiveSafetyScoreMessage(ContractModel):
    score_id: str
    live_id: str
    host_id: str
    kind: LiveSafetySignalKind
    frame_ref: str
    captured_at: datetime
    labels: list[DetectedModerationLabel]
    categories: list[LiveSafetyCategory]
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_action: LiveSafetySuggestedAction
    model_version: str
    transcript_snippet: str = ""
    hash_match: bool = False
    hash_match_provider: str = ""
    hash_match_reference: str = ""
    advisory_only: Literal[True] = True
    generated_at: datetime
