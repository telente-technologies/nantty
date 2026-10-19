from datetime import datetime
from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreCategory, SuggestedContentAction
from src.validators.common_field_validator import OpaqueIdentifier

HashCheckOutcome = Literal["matched", "clear", "unavailable", "disabled"]
ChildSafetySignal = Literal["none", "hash_match", "suspected_minor_explicit"]
MAXIMUM_SCAN_FRAMES = 6
MAXIMUM_FRAME_BASE64_LENGTH = 700_000


class HashMatch(ContractModel):
    provider: str
    reference: str


class MediaScanFrame(ContractModel):
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    data_base64: str = Field(min_length=4, max_length=MAXIMUM_FRAME_BASE64_LENGTH)


class MediaScanRequest(ContractModel):
    media_id: OpaqueIdentifier
    owner_id: OpaqueIdentifier | None = None
    purpose: str = Field(min_length=1, max_length=40)
    kind: Literal["image", "video"]
    original_sha256: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{64}$")
    frames: list[MediaScanFrame] = Field(default_factory=list, max_length=MAXIMUM_SCAN_FRAMES)


class ChildSafetyVerdict(ContractModel):
    blocked: bool
    signal: ChildSafetySignal
    hash_check: HashCheckOutcome
    provider: str = ""
    match_reference: str = ""


class MediaScanResponse(ContractModel):
    media_id: str
    score: float = Field(ge=0.0, le=1.0)
    top_category: str | None
    categories: list[ContentScoreCategory]
    suggested_action: SuggestedContentAction
    no_signal: bool
    child_safety: ChildSafetyVerdict
    model_version: str
    generated_at: datetime
