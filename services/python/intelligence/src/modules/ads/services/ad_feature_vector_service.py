import math
from collections.abc import Mapping

from src.modules.ads.dtos.ad_selection_dto import AdCandidate, AdPlacement
from src.utils.affinity_feature_util import summarize_topic_affinities
from src.utils.decay_math_util import calculate_smoothed_rate

AD_FEATURE_SCHEMA_VERSION = 1
AD_CLICK_RATE_PRIOR = 0.01
AD_CLICK_RATE_PRIOR_STRENGTH = 200.0

AD_FEATURE_NAMES: tuple[str, ...] = (
    "logit_smoothed_click_rate",
    "log_impressions",
    "creative_topic_affinity_max",
    "chosen_topic_match_count",
    "lookalike_similarity",
    "viewer_follows_advertiser",
    "placement_feed",
    "placement_clips",
    "placement_mart",
    "placement_search",
    "bid_type_cpc",
)


def calculate_ad_smoothed_click_rate(candidate: AdCandidate, online_statistics: Mapping[str, float]) -> float:
    impressions = max(float(candidate.lifetime_impressions), online_statistics.get("impressions", 0.0))
    clicks = min(max(float(candidate.lifetime_clicks), online_statistics.get("clicks", 0.0)), impressions)
    return calculate_smoothed_rate(clicks, impressions, AD_CLICK_RATE_PRIOR, AD_CLICK_RATE_PRIOR_STRENGTH)


def build_ad_feature_values(
    candidate: AdCandidate,
    placement: AdPlacement,
    online_statistics: Mapping[str, float],
    raw_topic_affinity: Mapping[str, float],
    chosen_topics: frozenset[str],
    followed_account_ids: frozenset[str],
    lookalike_similarity: float,
) -> list[float]:
    smoothed_click_rate = min(max(calculate_ad_smoothed_click_rate(candidate, online_statistics), 1e-6), 1 - 1e-6)
    creative_topic_affinity_max, _mean = summarize_topic_affinities(raw_topic_affinity, candidate.creative_topics)
    impressions = max(float(candidate.lifetime_impressions), online_statistics.get("impressions", 0.0))
    return [
        math.log(smoothed_click_rate / (1.0 - smoothed_click_rate)),
        math.log1p(impressions),
        creative_topic_affinity_max,
        float(sum(1 for topic in candidate.creative_topics if topic in chosen_topics)),
        lookalike_similarity,
        1.0 if candidate.advertiser_id in followed_account_ids else 0.0,
        1.0 if placement == "feed" else 0.0,
        1.0 if placement == "clips" else 0.0,
        1.0 if placement == "mart" else 0.0,
        1.0 if placement == "search" else 0.0,
        1.0 if candidate.bid_type == "cpc" else 0.0,
    ]


def calculate_cosine_similarity(first_vector: Mapping[str, float], second_vector: Mapping[str, float]) -> float:
    shared_keys = first_vector.keys() & second_vector.keys()
    dot_product = sum(first_vector[key] * second_vector[key] for key in shared_keys)
    first_norm = math.sqrt(sum(value * value for value in first_vector.values()))
    second_norm = math.sqrt(sum(value * value for value in second_vector.values()))
    if first_norm == 0 or second_norm == 0:
        return 0.0
    return max(dot_product / (first_norm * second_norm), 0.0)
