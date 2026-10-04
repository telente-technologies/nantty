import re

from src.constants.trend_category_taxonomy_constant import (
    MAXIMUM_TRENDING_HASHTAG_LENGTH,
    SPAM_HASHTAG_FRAGMENTS,
    TREND_CATEGORY_KEYWORDS,
    TrendCategory,
)

REPEATED_CHARACTER_PATTERN = re.compile(r"(.)\1{4,}")
DIGIT_HEAVY_PATTERN = re.compile(r"\d{6,}")


def normalise_trend_slug(slug: str) -> str:
    return re.sub(r"[^a-z0-9]", "", slug.lower())


def classify_trend_category(slug: str) -> TrendCategory:
    normalised = normalise_trend_slug(slug)
    if not normalised:
        return "other"
    for category, keywords in TREND_CATEGORY_KEYWORDS.items():
        if normalised in keywords:
            return category
    for category, keywords in TREND_CATEGORY_KEYWORDS.items():
        if any(len(keyword) >= 4 and keyword in normalised for keyword in keywords):
            return category
    return "other"


def is_spammy_hashtag(slug: str) -> bool:
    normalised = normalise_trend_slug(slug)
    if not normalised or len(normalised) > MAXIMUM_TRENDING_HASHTAG_LENGTH:
        return True
    if any(fragment in normalised for fragment in SPAM_HASHTAG_FRAGMENTS):
        return True
    return bool(REPEATED_CHARACTER_PATTERN.search(normalised) or DIGIT_HEAVY_PATTERN.search(normalised))


def count_spammy_hashtags(hashtags: list[str]) -> int:
    return sum(1 for hashtag in hashtags if is_spammy_hashtag(hashtag))
