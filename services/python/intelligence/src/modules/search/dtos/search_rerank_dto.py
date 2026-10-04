from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, RankingResponseMetadata, ViewerContext
from src.validators.common_field_validator import (
    MAXIMUM_RANKING_CANDIDATES,
    MAXIMUM_TOPICS_PER_ITEM,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    TopicSlug,
    UnitInterval,
)


class SearchResultCandidate(ContractModel):
    item_id: OpaqueIdentifier
    item_type: Literal["post", "clip", "product", "store", "account", "hashtag"]
    text_relevance_score: float = Field(ge=0.0, le=1e6)
    author_id: OpaqueIdentifier | None = None
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    popularity_count: NonNegativeCount = 0
    created_at: AwareDatetime | None = None
    country: CountryCode | None = None


class SearchRerankRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    viewer: ViewerContext
    candidates: list[SearchResultCandidate] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=30, ge=1, le=200)
    text_relevance_weight: UnitInterval = 0.7
    personalization_weight: UnitInterval = 0.2
    popularity_weight: UnitInterval = 0.1
    now: AwareDatetime | None = None


class RerankedSearchItem(ContractModel):
    item_id: str
    position: int
    score: float


class SearchRerankResponse(ContractModel):
    items: list[RerankedSearchItem]
    metadata: RankingResponseMetadata
