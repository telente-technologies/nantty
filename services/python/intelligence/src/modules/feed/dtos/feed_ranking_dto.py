from typing import Literal

from pydantic import AwareDatetime, Field

from src.constants.ranking_boost_caps_constant import AuthorRankingTier
from src.dtos.common_dto import ContractModel, ExcludedItem, MoneyAmount, RankingResponseMetadata, ViewerContext
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

FriendAction = Literal["liked", "commented", "shared", "purchased"]


class FriendEngagement(ContractModel):
    friend_id: OpaqueIdentifier
    action: FriendAction
    closeness: UnitInterval | None = None


class FeedCandidate(ContractModel):
    item_id: OpaqueIdentifier
    author_id: OpaqueIdentifier
    store_id: OpaqueIdentifier | None = None
    content_kind: Literal["personal", "product"] = "personal"
    media_kind: Literal["image", "video", "text", "carousel"] = "image"
    media_count: int = Field(default=1, ge=0, le=10)
    created_at: AwareDatetime
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    hashtags: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    like_count: NonNegativeCount = 0
    comment_count: NonNegativeCount = 0
    share_count: NonNegativeCount = 0
    repost_count: NonNegativeCount = 0
    save_count: NonNegativeCount = 0
    view_count: NonNegativeCount = 0
    completion_rate: UnitInterval | None = None
    author_follower_count: NonNegativeCount = 0
    author_is_verified: bool = False
    author_tier: AuthorRankingTier = "none"
    author_is_official: bool = False
    author_quality_prior: UnitInterval = 0.5
    integrity: EngagementIntegritySignals | None = None
    is_promoted: bool = False
    age_restricted: bool = False
    country: CountryCode | None = None
    is_sensitive: bool = False
    is_reported: bool = False
    product_price: MoneyAmount | None = None
    friend_engagements: list[FriendEngagement] = Field(default_factory=list, max_length=50)


class FeedRankingOptions(ContractModel):
    max_consecutive_same_author: int = Field(default=1, ge=1, le=5)
    max_consecutive_product_posts: int = Field(default=2, ge=1, le=10)
    maximum_product_post_share: UnitInterval = 0.4
    topic_repeat_penalty: float = Field(default=0.85, gt=0.0, le=1.0)
    topic_window_size: int = Field(default=3, ge=0, le=10)
    include_social_proof: bool = True
    social_proof_minimum_close_friends: int = Field(default=2, ge=1, le=10)
    social_proof_minimum_gap: int = Field(default=5, ge=1, le=50)
    social_proof_minimum_closeness: UnitInterval = 0.3


class FeedRankingRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    feed_mode: Literal["for_you", "following"] = "for_you"
    viewer: ViewerContext
    candidates: list[FeedCandidate] = Field(max_length=MAXIMUM_RANKING_CANDIDATES)
    limit: int = Field(default=30, ge=1, le=100)
    options: FeedRankingOptions = Field(default_factory=FeedRankingOptions)
    boost_policy: RankingBoostPolicy = Field(default_factory=RankingBoostPolicy)
    trending_topics: list[TopicSlug] = Field(default_factory=list, max_length=50)
    now: AwareDatetime | None = None


class SocialProofBanner(ContractModel):
    friend_ids: list[OpaqueIdentifier]
    total_friend_count: int
    primary_action: FriendAction


class RankedFeedItem(ContractModel):
    item_id: OpaqueIdentifier
    position: int
    score: float
    reasons: list[str]
    explanations: list[RankingExplanation] = Field(default_factory=list)
    boost_multiplier: float = 1.0
    trusted_engagement_share: float = 1.0
    social_proof: SocialProofBanner | None = None


class FeedRankingResponse(ContractModel):
    items: list[RankedFeedItem]
    excluded: list[ExcludedItem]
    manipulated_item_ids: list[str] = Field(default_factory=list)
    boost_policy_version: int = 0
    metadata: RankingResponseMetadata
