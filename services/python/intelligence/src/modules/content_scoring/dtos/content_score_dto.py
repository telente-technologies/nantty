from datetime import datetime
from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier

ContentScoreTargetType = Literal["post", "comment", "clip", "live", "product", "store", "sound"]
SuggestedContentAction = Literal["allow", "review", "block"]


class ContentScoreCategory(ContractModel):
    category: str
    score: float = Field(ge=0.0, le=1.0)


class ContentScoreMessage(ContractModel):
    score_id: str
    target_type: ContentScoreTargetType
    target_id: str
    owner_id: str
    score: float = Field(ge=0.0, le=1.0)
    suggested_action: SuggestedContentAction
    categories: list[ContentScoreCategory]
    model_version: str
    advisory_only: Literal[True] = True
    generated_at: datetime


class ImageModerationRequest(ContractModel):
    media_id: OpaqueIdentifier
    owner_id: OpaqueIdentifier | None = None
    purpose: str | None = Field(default=None, max_length=40)
    image_url: str | None = Field(default=None, max_length=2000)
    frame_index: int | None = Field(default=None, ge=0, le=10_000)
    frame_timestamp_seconds: float | None = Field(default=None, ge=0)


class ImageModerationResponse(ContractModel):
    media_id: str
    categories: list[ContentScoreCategory]
    score: float
    suggested_action: SuggestedContentAction
    no_signal: bool
    model_version: str
    advisory_only: Literal[True] = True
    generated_at: datetime
