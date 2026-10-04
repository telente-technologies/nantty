from typing import Literal

from pydantic import AwareDatetime, Field

from src.constants.trend_category_taxonomy_constant import TrendCategory
from src.dtos.common_dto import ContractModel, RankingResponseMetadata
from src.modules.feed.dtos.feed_fairness_dto import EngagementIntegritySignals
from src.validators.common_field_validator import (
    MAXIMUM_TOPICS_PER_ITEM,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    TopicSlug,
)

HEADLINE_SOURCE_LABEL: Literal["Summarised from posts"] = "Summarised from posts"


class HeadlinePost(ContractModel):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier
    text: str = Field(default="", max_length=2000)
    hashtags: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    created_at: AwareDatetime
    like_count: NonNegativeCount = 0
    comment_count: NonNegativeCount = 0
    repost_count: NonNegativeCount = 0
    share_count: NonNegativeCount = 0
    view_count: NonNegativeCount = 0
    is_sensitive: bool = False
    age_restricted: bool = False
    is_public: bool = True
    integrity: EngagementIntegritySignals | None = None


class HeadlineRequest(ContractModel):
    country: CountryCode | None = None
    category: TrendCategory | None = None
    posts: list[HeadlinePost] = Field(max_length=1000)
    limit: int = Field(default=8, ge=1, le=20)
    minimum_posts_per_story: int = Field(default=3, ge=2, le=100)
    minimum_distinct_authors: int = Field(default=3, ge=2, le=100)
    excluded_story_keys: list[TopicSlug] = Field(default_factory=list, max_length=500)
    now: AwareDatetime | None = None


class Headline(ContractModel):
    story_key: str
    title: str
    summary: str
    category: TrendCategory
    post_ids: list[str]
    post_count: int
    author_count: int
    top_hashtags: list[str]
    source_label: Literal["Summarised from posts"] = HEADLINE_SOURCE_LABEL
    generated_by: Literal["extractive_v1", "template_v1"]
    updated_at: AwareDatetime


class HeadlineResponse(ContractModel):
    headlines: list[Headline]
    metadata: RankingResponseMetadata
