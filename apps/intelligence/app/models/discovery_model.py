from typing import Literal

from pydantic import AwareDatetime, Field

from app.models.common_model import (
    MAXIMUM_RANKING_CANDIDATES,
    MAXIMUM_TOPICS_PER_ITEM,
    ContractModel,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    RankingResponseMetadata,
    TopicSlug,
    UnitInterval,
    ViewerContext,
)

TrendingKind = Literal["hashtag", "topic", "post", "clip", "product"]


class TrendingRequest(ContractModel):
    kind: TrendingKind
    country: CountryCode | None = None
    limit: int = Field(default=20, ge=1, le=100)
    minimum_distinct_actors: int = Field(default=5, ge=1, le=10_000)
    excluded_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=1000)
    now: AwareDatetime | None = None


class TrendingItem(ContractModel):
    item_id: str
    score: float
    acceleration: float
    distinct_actors: int


class TrendingResponse(ContractModel):
    kind: TrendingKind
    scope: str
    items: list[TrendingItem]
    metadata: RankingResponseMetadata


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
