from typing import Literal

AuthorRankingTier = Literal["none", "blue_essential", "blue_verified", "premium", "gold_business", "black_official"]

TIER_ORDER_FROM_LOWEST: tuple[AuthorRankingTier, ...] = (
    "blue_essential",
    "blue_verified",
    "premium",
    "gold_business",
    "black_official",
)

HARD_MAXIMUM_TIER_BOOST: dict[AuthorRankingTier, float] = {
    "none": 1.0,
    "blue_essential": 1.05,
    "blue_verified": 1.08,
    "premium": 1.10,
    "gold_business": 1.12,
    "black_official": 1.15,
}

DEFAULT_TIER_BOOST: dict[AuthorRankingTier, float] = {
    "none": 1.0,
    "blue_essential": 1.02,
    "blue_verified": 1.04,
    "premium": 1.06,
    "gold_business": 1.08,
    "black_official": 1.10,
}

HARD_MAXIMUM_OFFICIAL_EDITORIAL_BOOST = 1.15
DEFAULT_OFFICIAL_EDITORIAL_BOOST = 1.10
HARD_MAXIMUM_COMBINED_BOOST = 1.25
