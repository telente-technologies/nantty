from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, ExcludedItem, RankingResponseMetadata, ViewerContext
from src.validators.common_field_validator import (
    MAXIMUM_RANKING_CANDIDATES,
    MAXIMUM_TOPICS_PER_ITEM,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    TopicSlug,
    UnitInterval,
)


class ClipCandidate(ContractModel):
    item_id: OpaqueIdentifier
    creator_id: OpaqueIdentifier
    created_at: AwareDatetime
    duration_ms: int = Field(ge=0, le=3_600_000)
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    hashtags: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    view_count: NonNegativeCount = 0
    completion_count: NonNegativeCount = 0
    rewatch_count: NonNegativeCount = 0
    creator_follower_count: NonNegativeCount = 0
    creator_is_new: bool = False
    country: CountryCode | None = None
    is_sensitive: bool = False


class ClipRankingRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    viewer: ViewerContext
    candidates: list[ClipCandidate] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=20, ge=1, le=100)
    exploration_share: UnitInterval = 0.2
    now: AwareDatetime | None = None


class RankedClipItem(ContractModel):
    item_id: OpaqueIdentifier
    position: int
    score: float
    is_exploration: bool
    reasons: list[str]


class ClipRankingResponse(ContractModel):
    items: list[RankedClipItem]
    excluded: list[ExcludedItem]
    metadata: RankingResponseMetadata
