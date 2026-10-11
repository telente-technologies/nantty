from pydantic import AwareDatetime, Field

from src.constants.ranking_boost_caps_constant import AuthorRankingTier
from src.dtos.common_dto import ContractModel, ExcludedItem, RankingResponseMetadata, ViewerContext
from src.modules.feed.dtos.feed_fairness_dto import EngagementIntegritySignals, RankingBoostPolicy, RankingExplanation
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
    like_count: NonNegativeCount = 0
    comment_count: NonNegativeCount = 0
    share_count: NonNegativeCount = 0
    save_count: NonNegativeCount = 0
    author_tier: AuthorRankingTier = "none"
    author_is_official: bool = False
    integrity: EngagementIntegritySignals | None = None
    is_promoted: bool = False
    age_restricted: bool = False
    country: CountryCode | None = None
    is_sensitive: bool = False


class ClipRankingRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    viewer: ViewerContext
    candidates: list[ClipCandidate] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=20, ge=1, le=100)
    exploration_share: UnitInterval = 0.2
    personalized: bool = True
    boost_policy: RankingBoostPolicy = Field(default_factory=RankingBoostPolicy)
    trending_topics: list[TopicSlug] = Field(default_factory=list, max_length=50)
    now: AwareDatetime | None = None


class RankedClipItem(ContractModel):
    item_id: OpaqueIdentifier
    position: int
    score: float
    is_exploration: bool
    reasons: list[str]
    explanations: list[RankingExplanation] = Field(default_factory=list)
    boost_multiplier: float = 1.0
    trusted_engagement_share: float = 1.0


class ClipRankingResponse(ContractModel):
    items: list[RankedClipItem]
    excluded: list[ExcludedItem]
    manipulated_item_ids: list[str] = Field(default_factory=list)
    boost_policy_version: int = 0
    metadata: RankingResponseMetadata
