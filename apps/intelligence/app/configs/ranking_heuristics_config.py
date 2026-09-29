from app.features.clip_feature_vector_builder import CLIP_FEATURE_NAMES
from app.features.feed_feature_vector_builder import FEED_FEATURE_NAMES
from app.services.head_probability_predictor_service import HeuristicLogisticHeads

FEED_ENGAGEMENT_BLEND_WEIGHTS: dict[str, float] = {
    "like": 1.0,
    "comment": 2.0,
    "share": 3.0,
    "long_dwell": 0.8,
    "purchase_intent": 4.0,
}

FEED_FRESHNESS_HALF_LIFE_HOURS = 36.0
FEED_FRESHNESS_MINIMUM_MULTIPLIER = 0.08
FEED_CREATOR_AFFINITY_BOOST = 0.5
FOLLOWING_FEED_MAXIMUM_BOOST_MINUTES = 90.0

FEED_HEURISTIC_HEADS = HeuristicLogisticHeads(
    feature_names=FEED_FEATURE_NAMES,
    intercept_and_weights_by_head={
        "like": (
            -3.0,
            {
                "creator_affinity": 2.5,
                "topic_affinity_max": 2.0,
                "chosen_topic_match_count": 0.4,
                "like_rate": 8.0,
                "viewer_follows_author": 0.8,
                "same_country_as_viewer": 0.5,
                "friend_engagement_count": 0.15,
                "negative_feedback_rate": -10.0,
            },
        ),
        "comment": (
            -4.5,
            {
                "creator_affinity": 2.5,
                "topic_affinity_max": 1.5,
                "comment_rate": 30.0,
                "viewer_follows_author": 0.8,
                "friend_engagement_count": 0.15,
                "negative_feedback_rate": -10.0,
            },
        ),
        "share": (
            -5.0,
            {
                "creator_affinity": 2.0,
                "topic_affinity_max": 1.5,
                "share_rate": 50.0,
                "friend_engagement_count": 0.2,
                "negative_feedback_rate": -10.0,
            },
        ),
        "long_dwell": (
            -1.5,
            {
                "creator_affinity": 1.5,
                "topic_affinity_max": 1.5,
                "chosen_topic_match_count": 0.3,
                "long_dwell_rate": 2.0,
                "is_video": 0.3,
                "media_count": 0.1,
                "negative_feedback_rate": -10.0,
            },
        ),
        "purchase_intent": (
            -6.0,
            {
                "is_product_post": 3.0,
                "creator_affinity": 1.5,
                "topic_affinity_max": 1.5,
                "chosen_topic_match_count": 0.3,
                "product_click_rate": 20.0,
                "same_country_as_viewer": 0.5,
                "negative_feedback_rate": -10.0,
            },
        ),
    },
)

CLIP_HEURISTIC_HEADS = HeuristicLogisticHeads(
    feature_names=CLIP_FEATURE_NAMES,
    intercept_and_weights_by_head={
        "completion": (
            -2.0,
            {
                "completion_rate": 3.0,
                "average_watch_fraction": 1.0,
                "creator_affinity": 1.5,
                "topic_affinity_max": 1.5,
                "chosen_topic_match_count": 0.3,
                "viewer_follows_creator": 0.5,
                "log_duration_seconds": -0.3,
                "same_country_as_viewer": 0.3,
            },
        ),
        "rewatch": (
            -3.5,
            {
                "rewatch_rate": 6.0,
                "creator_affinity": 1.5,
                "topic_affinity_max": 1.0,
                "log_duration_seconds": -0.4,
            },
        ),
    },
)
