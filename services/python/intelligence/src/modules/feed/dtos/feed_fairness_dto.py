from typing import Literal

from pydantic import Field

from src.constants.ranking_boost_caps_constant import (
    DEFAULT_OFFICIAL_EDITORIAL_BOOST,
    DEFAULT_TIER_BOOST,
    AuthorRankingTier,
)
from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import NonNegativeCount, UnitInterval

ExplanationCode = Literal[
    "following",
    "trending_topic",
    "similar_to_liked",
    "popular_near_you",
    "friends_engaged",
    "fresh",
    "popular",
    "promoted",
    "checkmark_boost",
    "official_boost",
]


class RankingBoostPolicy(ContractModel):
    version: int = Field(default=0, ge=0)
    tier_boosts: dict[AuthorRankingTier, float] = Field(default_factory=lambda: dict(DEFAULT_TIER_BOOST))
    official_editorial_boost: float = Field(default=DEFAULT_OFFICIAL_EDITORIAL_BOOST, ge=1.0, le=10.0)


class EngagementIntegritySignals(ContractModel):
    engager_count: NonNegativeCount = 0
    new_account_engager_share: UnitInterval = 0.0
    low_trust_engager_share: UnitInterval = 0.0
    suspended_engager_share: UnitInterval = 0.0
    clustered_engager_share: UnitInterval = 0.0
    reciprocal_pod_share: UnitInterval = 0.0
    burst_ratio: UnitInterval = 0.0
    purchased_engagement_suspected: bool = False
    spam_hashtag_count: int = Field(default=0, ge=0, le=100)


class RankingExplanation(ContractModel):
    code: ExplanationCode
    label: str
    detail: str | None = None
