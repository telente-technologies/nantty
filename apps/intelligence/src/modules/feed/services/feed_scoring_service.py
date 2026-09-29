from dataclasses import dataclass

from src.configs.ranking_heuristics_config import (
    FEED_CREATOR_AFFINITY_BOOST,
    FEED_ENGAGEMENT_BLEND_WEIGHTS,
    FEED_FRESHNESS_HALF_LIFE_HOURS,
    FEED_FRESHNESS_MINIMUM_MULTIPLIER,
    FEED_HEURISTIC_HEADS,
    FOLLOWING_FEED_MAXIMUM_BOOST_MINUTES,
)
from src.modules.feed.dtos.feed_ranking_dto import FeedCandidate
from src.modules.feed.services.feed_feature_vector_service import FEED_FEATURE_NAMES
from src.modules.model_registry.models.model_bundle_model import LoadedModel
from src.services.head_probability_predictor_service import (
    blend_head_probabilities,
    predict_heads_with_model_or_heuristic,
)
from src.utils.decay_math_util import calculate_freshness_decay_multiplier, squash_non_negative_value_into_unit_interval

MODEL_SCORED_CANDIDATE_LIMIT = 120


@dataclass(frozen=True, slots=True)
class FeedScoringOutcome:
    final_score_by_item: dict[str, float]
    ranking_source: str
    model_version: str | None


def calculate_following_feed_boosted_timestamp(candidate: FeedCandidate, features: dict[str, float]) -> float:
    engagement_signal = squash_non_negative_value_into_unit_interval(features["like_rate"] * 10, 1.0)
    boost_strength = 0.6 * max(features["creator_affinity"], 0.0) + 0.4 * engagement_signal
    return candidate.created_at.timestamp() + boost_strength * FOLLOWING_FEED_MAXIMUM_BOOST_MINUTES * 60


def calculate_for_you_score(candidate: FeedCandidate, features: dict[str, float], blended_engagement: float) -> float:
    freshness = calculate_freshness_decay_multiplier(
        features["age_hours"], FEED_FRESHNESS_HALF_LIFE_HOURS, FEED_FRESHNESS_MINIMUM_MULTIPLIER
    )
    affinity_multiplier = 1.0 + FEED_CREATOR_AFFINITY_BOOST * max(features["creator_affinity"], 0.0)
    reported_multiplier = 0.3 if candidate.is_reported else 1.0
    return blended_engagement * freshness * affinity_multiplier * reported_multiplier


def score_rows_with_blended_engagement(
    candidates: list[FeedCandidate],
    feature_rows: list[list[float]],
    feature_mappings: list[dict[str, float]],
    row_indices: list[int],
    loaded_model: LoadedModel | None,
) -> tuple[dict[str, float], str, str | None]:
    prediction = predict_heads_with_model_or_heuristic(
        [feature_rows[index] for index in row_indices],
        FEED_FEATURE_NAMES,
        loaded_model.bundle if loaded_model else None,
        loaded_model.version if loaded_model else None,
        FEED_HEURISTIC_HEADS,
    )
    blended = blend_head_probabilities(prediction.probabilities_by_head, FEED_ENGAGEMENT_BLEND_WEIGHTS).tolist()
    scores = {
        candidates[index].item_id: calculate_for_you_score(
            candidates[index], feature_mappings[index], float(engagement)
        )
        for index, engagement in zip(row_indices, blended, strict=True)
    }
    return scores, prediction.ranking_source, prediction.model_version


def score_feed_candidates_in_two_stages(
    candidates: list[FeedCandidate],
    feature_rows: list[list[float]],
    feature_mappings: list[dict[str, float]],
    feed_mode: str,
    loaded_model: LoadedModel | None,
) -> FeedScoringOutcome:
    if not candidates:
        return FeedScoringOutcome({}, "heuristic", None)
    if feed_mode == "following":
        return FeedScoringOutcome(
            {
                candidate.item_id: calculate_following_feed_boosted_timestamp(candidate, features)
                for candidate, features in zip(candidates, feature_mappings, strict=True)
            },
            "heuristic",
            None,
        )
    all_indices = list(range(len(candidates)))
    if loaded_model is None or len(candidates) <= MODEL_SCORED_CANDIDATE_LIMIT:
        scores, source, version = score_rows_with_blended_engagement(
            candidates, feature_rows, feature_mappings, all_indices, loaded_model
        )
        return FeedScoringOutcome(scores, source, version)
    light_scores, _source, _version = score_rows_with_blended_engagement(
        candidates, feature_rows, feature_mappings, all_indices, None
    )
    index_by_item = {candidate.item_id: index for index, candidate in enumerate(candidates)}
    shortlisted_items = sorted(light_scores, key=lambda item_id: (-light_scores[item_id], item_id))
    shortlisted_indices = [index_by_item[item_id] for item_id in shortlisted_items[:MODEL_SCORED_CANDIDATE_LIMIT]]
    scores, source, version = score_rows_with_blended_engagement(
        candidates, feature_rows, feature_mappings, shortlisted_indices, loaded_model
    )
    return FeedScoringOutcome(scores, f"{source}_two_stage", version)
