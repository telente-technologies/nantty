import math
from datetime import datetime

from src.dtos.common_dto import ViewerContext
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.clips.dtos.clip_ranking_dto import ClipCandidate
from src.utils.affinity_feature_util import read_normalized_affinity, summarize_topic_affinities
from src.utils.decay_math_util import calculate_age_in_hours, calculate_smoothed_rate

CLIP_FEATURE_SCHEMA_VERSION = 1
NEW_CREATOR_WATCH_THRESHOLD = 50.0

CLIP_FEATURE_NAMES: tuple[str, ...] = (
    "age_hours",
    "log_duration_seconds",
    "log_view_count",
    "completion_rate",
    "rewatch_rate",
    "average_watch_fraction",
    "log_creator_follower_count",
    "creator_is_new",
    "viewer_follows_creator",
    "creator_affinity",
    "topic_affinity_max",
    "chosen_topic_match_count",
    "same_country_as_viewer",
)


def read_clip_watch_counts(
    candidate: ClipCandidate, online_features: ViewerOnlineFeatures
) -> tuple[float, float, float]:
    item_statistics = online_features.item_statistics_by_item.get(candidate.item_id, {})
    watches = max(float(candidate.view_count), item_statistics.get("watches", 0.0))
    completions = max(float(candidate.completion_count), item_statistics.get("completions", 0.0))
    rewatches = max(float(candidate.rewatch_count), item_statistics.get("rewatches", 0.0))
    return watches, min(completions, watches), min(rewatches, watches)


def is_exploration_eligible_clip(candidate: ClipCandidate, online_features: ViewerOnlineFeatures) -> bool:
    watches, _completions, _rewatches = read_clip_watch_counts(candidate, online_features)
    return candidate.creator_is_new or watches < NEW_CREATOR_WATCH_THRESHOLD


def build_clip_feature_values(
    candidate: ClipCandidate,
    viewer: ViewerContext,
    followed_account_ids: frozenset[str],
    chosen_topics: frozenset[str],
    online_features: ViewerOnlineFeatures,
    now: datetime,
) -> list[float]:
    item_statistics = online_features.item_statistics_by_item.get(candidate.item_id, {})
    watches, completions, rewatches = read_clip_watch_counts(candidate, online_features)
    online_watches = item_statistics.get("watches", 0.0)
    all_topics = [*candidate.topics, *candidate.hashtags]
    topic_affinity_max, _topic_affinity_mean = summarize_topic_affinities(
        online_features.topic_affinity_by_topic, all_topics
    )
    return [
        min(calculate_age_in_hours(candidate.created_at, now), 24.0 * 60),
        math.log1p(candidate.duration_ms / 1000.0),
        math.log1p(watches),
        calculate_smoothed_rate(completions, watches, 0.35, 20.0),
        calculate_smoothed_rate(rewatches, watches, 0.08, 20.0),
        calculate_smoothed_rate(item_statistics.get("watch_fraction_sum", 0.0), online_watches, 0.5, 20.0),
        math.log1p(candidate.creator_follower_count),
        1.0 if candidate.creator_is_new else 0.0,
        1.0 if candidate.creator_id in followed_account_ids else 0.0,
        read_normalized_affinity(online_features.account_affinity_by_account, candidate.creator_id),
        topic_affinity_max,
        float(sum(1 for topic in all_topics if topic in chosen_topics)),
        1.0 if viewer.country is not None and candidate.country == viewer.country else 0.0,
    ]
