from src.constants.ranking_boost_caps_constant import (
    HARD_MAXIMUM_COMBINED_BOOST,
    HARD_MAXIMUM_OFFICIAL_EDITORIAL_BOOST,
    HARD_MAXIMUM_TIER_BOOST,
    TIER_ORDER_FROM_LOWEST,
    AuthorRankingTier,
)
from src.modules.feed.dtos.feed_fairness_dto import RankingBoostPolicy


def clamp_multiplier(value: float, maximum: float) -> float:
    return round(min(max(value, 1.0), maximum), 6)


def clamp_boost_policy_to_hard_caps(policy: RankingBoostPolicy) -> RankingBoostPolicy:
    clamped: dict[AuthorRankingTier, float] = {"none": 1.0}
    previous = 1.0
    for tier in TIER_ORDER_FROM_LOWEST:
        value = clamp_multiplier(policy.tier_boosts.get(tier, 1.0), HARD_MAXIMUM_TIER_BOOST[tier])
        previous = max(previous, value)
        clamped[tier] = min(previous, HARD_MAXIMUM_TIER_BOOST[tier])
    return RankingBoostPolicy(
        version=policy.version,
        tier_boosts=clamped,
        official_editorial_boost=clamp_multiplier(
            policy.official_editorial_boost, HARD_MAXIMUM_OFFICIAL_EDITORIAL_BOOST
        ),
    )


def calculate_capped_author_boost(
    tier: AuthorRankingTier, is_official_account: bool, clamped_policy: RankingBoostPolicy
) -> float:
    tier_boost = clamped_policy.tier_boosts.get(tier, 1.0)
    editorial_boost = clamped_policy.official_editorial_boost if is_official_account else 1.0
    return round(min(tier_boost * editorial_boost, HARD_MAXIMUM_COMBINED_BOOST), 6)
