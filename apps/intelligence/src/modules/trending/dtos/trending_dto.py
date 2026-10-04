from typing import Literal

from pydantic import AwareDatetime, Field

from src.constants.trend_category_taxonomy_constant import TrendCategory
from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.validators.common_field_validator import (
    CountryCode,
    OpaqueIdentifier,
)

TrendingKind = Literal["hashtag", "topic", "post", "clip", "product"]


class TrendingRequest(ContractModel):
    kind: TrendingKind
    country: CountryCode | None = None
    category: TrendCategory | None = None
    limit: int = Field(default=20, ge=1, le=100)
    minimum_distinct_actors: int = Field(default=5, ge=1, le=10_000)
    excluded_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=1000)
    now: AwareDatetime | None = None


class TrendingItem(ContractModel):
    item_id: str
    score: float
    acceleration: float
    distinct_actors: int
    category: TrendCategory = "other"
    manipulation_share: float = 0.0


class TrendingResponse(ContractModel):
    kind: TrendingKind
    scope: str
    category: TrendCategory | None = None
    items: list[TrendingItem]
    manipulated_ids: list[str] = Field(default_factory=list)
    metadata: RankingResponseMetadata
