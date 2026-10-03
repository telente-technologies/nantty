from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.validators.common_field_validator import OpaqueIdentifier

ModerationCategory = Literal["scam", "spam", "harassment", "violence", "prohibited_goods", "personal_data"]
ModerationContentType = Literal["post", "comment", "clip_caption", "bio", "product_listing", "store_description"]


class ContentModerationRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    content_id: OpaqueIdentifier
    content_type: ModerationContentType
    text: str = Field(min_length=1, max_length=5000)
    author_id: OpaqueIdentifier | None = None
    now: AwareDatetime | None = None


class CategoryScore(ContractModel):
    category: ModerationCategory
    score: float
    signals: list[str]


class ContentModerationResponse(ContractModel):
    content_id: str
    categories: list[CategoryScore]
    top_category: ModerationCategory | None
    score: float
    suggested_action: Literal["allow", "review", "block"]
    classifier_sources: list[str]
    metadata: RankingResponseMetadata
