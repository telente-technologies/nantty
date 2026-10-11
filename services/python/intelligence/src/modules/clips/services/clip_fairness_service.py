from collections.abc import Sequence
from dataclasses import dataclass

from src.dtos.common_dto import ExcludedItem, ViewerContext
from src.modules.clips.dtos.clip_ranking_dto import ClipCandidate
from src.modules.feed.dtos.feed_fairness_dto import RankingBoostPolicy, RankingExplanation
from src.modules.feed.services.feed_fairness_service import (
    ADULT_AGE_BRACKETS,
    MAXIMUM_EXPLANATIONS,
    UNKNOWN_INTEGRITY_ASSESSMENT,
    describe_boost_percentage,
)
from src.services.engagement_integrity_service import (
    IntegrityAssessment,
    assess_engagement_integrity,
    combine_online_integrity_counters,
    discount_engagement_count,
)
from src.services.ranking_boost_policy_service import calculate_capped_author_boost

CLIP_ENGAGEMENT_WEIGHT = 0.25
CLIP_ENGAGEMENT_SATURATION_RATE = 0.2
CLIP_INTEGRITY_SCORE_FLOOR = 0.3
POPULAR_COMPLETION_RATE = 0.55
SIMILAR_AFFINITY_THRESHOLD = 0.3
FRESH_CLIP_HOURS = 6.0


@dataclass(frozen=True, slots=True)
class ClipSafetyOutcome:
    kept_candidates: list[ClipCandidate]
    excluded_items: list[ExcludedItem]


def filter_clips_for_viewer_safety(candidates: Sequence[ClipCandidate], viewer: ViewerContext) -> ClipSafetyOutcome:
    viewer_is_adult = viewer.age_bracket in ADULT_AGE_BRACKETS
    kept: list[ClipCandidate] = []
    excluded: list[ExcludedItem] = []
    for candidate in candidates:
        if candidate.age_restricted and not viewer_is_adult:
            excluded.append(ExcludedItem(item_id=candidate.item_id, reason="age_restricted"))
        elif candidate.is_sensitive and not viewer_is_adult:
            excluded.append(ExcludedItem(item_id=candidate.item_id, reason="sensitive_for_viewer"))
        else:
            kept.append(candidate)
    return ClipSafetyOutcome(kept, excluded)


def assess_clip_integrity(
    candidates: Sequence[ClipCandidate],
    item_statistics_by_item: dict[str, dict[str, float]],
    online_counters_available: bool,
) -> dict[str, IntegrityAssessment]:
    return {
        candidate.item_id: (
            UNKNOWN_INTEGRITY_ASSESSMENT
            if candidate.integrity is None and not online_counters_available
            else assess_engagement_integrity(
                combine_online_integrity_counters(
                    candidate.integrity, item_statistics_by_item.get(candidate.item_id, {})
                )
            )
        )
        for candidate in candidates
    }


def discount_clip_engagement(candidate: ClipCandidate, assessment: IntegrityAssessment) -> ClipCandidate:
    return candidate.model_copy(
        update={
            field_name: discount_engagement_count(getattr(candidate, field_name), assessment)
            for field_name in (
                "like_count",
                "comment_count",
                "share_count",
                "save_count",
                "completion_count",
                "rewatch_count",
            )
        }
    )


def calculate_clip_engagement_signal(candidate: ClipCandidate, watches: float) -> float:
    weighted = candidate.like_count + 2 * candidate.save_count + 3 * candidate.comment_count + 4 * candidate.share_count
    rate = weighted / max(watches, float(candidate.view_count), 1.0)
    return min(rate / CLIP_ENGAGEMENT_SATURATION_RATE, 1.0)


def calculate_integrity_multiplier(assessment: IntegrityAssessment) -> float:
    return CLIP_INTEGRITY_SCORE_FLOOR + (1.0 - CLIP_INTEGRITY_SCORE_FLOOR) * assessment.trusted_engagement_share


def calculate_clip_author_boost(candidate: ClipCandidate, clamped_policy: RankingBoostPolicy) -> float:
    return calculate_capped_author_boost(candidate.author_tier, candidate.author_is_official, clamped_policy)


def build_clip_explanations(
    candidate: ClipCandidate,
    features: dict[str, float],
    trending_topics: frozenset[str],
    boost: float,
    is_exploration: bool,
) -> list[RankingExplanation]:
    explanations: list[RankingExplanation] = []
    if candidate.is_promoted:
        explanations.append(RankingExplanation(code="promoted", label="Promoted"))
    if features["viewer_follows_creator"] > 0:
        explanations.append(RankingExplanation(code="following", label="You follow this account"))
    trending_tag = next((tag for tag in [*candidate.hashtags, *candidate.topics] if tag in trending_topics), None)
    if trending_tag is not None:
        explanations.append(
            RankingExplanation(code="trending_topic", label=f"Trending: #{trending_tag}", detail=trending_tag)
        )
    if (
        features["creator_affinity"] > SIMILAR_AFFINITY_THRESHOLD
        or features["topic_affinity_max"] > SIMILAR_AFFINITY_THRESHOLD
    ):
        explanations.append(RankingExplanation(code="similar_to_liked", label="Similar to clips you watched"))
    popular = features["completion_rate"] > POPULAR_COMPLETION_RATE
    if features["same_country_as_viewer"] > 0 and popular:
        explanations.append(RankingExplanation(code="popular_near_you", label="Popular near you"))
    if not explanations and popular:
        explanations.append(RankingExplanation(code="popular", label="People watch this to the end"))
    if not explanations and (is_exploration or features["age_hours"] < FRESH_CLIP_HOURS):
        label = "New creator you might like" if is_exploration else "New clip"
        explanations.append(RankingExplanation(code="fresh", label=label))
    explanations = explanations[:MAXIMUM_EXPLANATIONS]
    if boost > 1.0:
        official = candidate.author_is_official
        explanations.append(
            RankingExplanation(
                code="official_boost" if official else "checkmark_boost",
                label="Official account" if official else "Checkmark account",
                detail=f"Gets a disclosed ranking boost of {describe_boost_percentage(boost)}, capped for everyone",
            )
        )
    return explanations
