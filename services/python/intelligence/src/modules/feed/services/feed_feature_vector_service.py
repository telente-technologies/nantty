import math
from collections.abc import Sequence
from datetime import datetime

from src.dtos.common_dto import ViewerContext
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.feed.dtos.feed_ranking_dto import FeedCandidate
from src.utils.affinity_feature_util import RATE_PRIOR_STRENGTH, read_normalized_affinity, summarize_topic_affinities
from src.utils.decay_math_util import (
    calculate_age_in_hours,
    calculate_smoothed_rate,
)

FEED_FEATURE_SCHEMA_VERSION = 1

FEED_FEATURE_NAMES: tuple[str, ...] = (
    "age_hours",
    "log_like_count",
    "log_comment_count",
    "log_share_count",
    "log_view_count",
    "like_rate",
    "comment_rate",
    "share_rate",
    "long_dwell_rate",
    "average_dwell_seconds",
    "log_author_follower_count",
    "author_is_verified",
    "viewer_follows_author",
    "creator_affinity",
    "topic_affinity_max",
    "topic_affinity_mean",
    "chosen_topic_match_count",
    "is_product_post",
    "is_video",
    "media_count",
    "same_country_as_viewer",
    "friend_engagement_count",
    "product_click_rate",
    "negative_feedback_rate",
)


def build_feed_feature_values(
    candidate: FeedCandidate,
    viewer: ViewerContext,
    followed_account_ids: frozenset[str],
    chosen_topics: frozenset[str],
    online_features: ViewerOnlineFeatures,
    now: datetime,
) -> list[float]:
    item_statistics = online_features.item_statistics_by_item.get(candidate.item_id, {})
    online_views = item_statistics.get("views", 0.0)
    view_denominator = max(float(candidate.view_count), online_views)
    creator_affinity = max(
        read_normalized_affinity(online_features.account_affinity_by_account, candidate.author_id),
        read_normalized_affinity(online_features.account_affinity_by_account, candidate.store_id),
    )
    all_topics = [*candidate.topics, *candidate.hashtags]
    topic_affinity_max, topic_affinity_mean = summarize_topic_affinities(
        online_features.topic_affinity_by_topic, all_topics
    )
    viewer_follows_author = candidate.author_id in followed_account_ids or (
        candidate.store_id is not None and candidate.store_id in followed_account_ids
    )
    negative_feedback_count = item_statistics.get("reports", 0.0) * 3.0 + item_statistics.get("hides", 0.0)
    return [
        min(calculate_age_in_hours(candidate.created_at, now), 24.0 * 30),
        math.log1p(candidate.like_count),
        math.log1p(candidate.comment_count),
        math.log1p(candidate.share_count),
        math.log1p(candidate.view_count),
        calculate_smoothed_rate(candidate.like_count, view_denominator, 0.05, RATE_PRIOR_STRENGTH),
        calculate_smoothed_rate(candidate.comment_count, view_denominator, 0.01, RATE_PRIOR_STRENGTH),
        calculate_smoothed_rate(candidate.share_count, view_denominator, 0.005, RATE_PRIOR_STRENGTH),
        calculate_smoothed_rate(item_statistics.get("long_dwells", 0.0), online_views, 0.2, RATE_PRIOR_STRENGTH),
        item_statistics.get("dwell_ms_sum", 0.0) / max(online_views, 1.0) / 1000.0,
        math.log1p(candidate.author_follower_count),
        1.0 if candidate.author_is_verified else 0.0,
        1.0 if viewer_follows_author else 0.0,
        creator_affinity,
        topic_affinity_max,
        topic_affinity_mean,
        float(sum(1 for topic in all_topics if topic in chosen_topics)),
        1.0 if candidate.content_kind == "product" else 0.0,
        1.0 if candidate.media_kind == "video" else 0.0,
        float(candidate.media_count),
        1.0 if viewer.country is not None and candidate.country == viewer.country else 0.0,
        float(len(candidate.friend_engagements)),
        calculate_smoothed_rate(item_statistics.get("product_clicks", 0.0), online_views, 0.02, RATE_PRIOR_STRENGTH),
        calculate_smoothed_rate(negative_feedback_count, view_denominator, 0.0, RATE_PRIOR_STRENGTH),
    ]


def convert_feature_values_to_mapping(feature_values: Sequence[float]) -> dict[str, float]:
    return dict(zip(FEED_FEATURE_NAMES, feature_values, strict=True))
