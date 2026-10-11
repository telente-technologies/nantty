from collections.abc import Sequence
from dataclasses import dataclass

from src.dtos.common_dto import ExcludedItem, ViewerContext
from src.modules.feed.dtos.feed_fairness_dto import RankingBoostPolicy, RankingExplanation
from src.modules.feed.dtos.feed_ranking_dto import FeedCandidate
from src.services.engagement_integrity_service import (
    IntegrityAssessment,
    assess_engagement_integrity,
    combine_online_integrity_counters,
    discount_engagement_count,
)
from src.services.ranking_boost_policy_service import calculate_capped_author_boost

ADULT_AGE_BRACKETS = frozenset({"18-24", "25-34", "35-44", "45-54", "55-64", "65+"})
SAVE_WEIGHT_IN_LIKES = 2
AUTHOR_QUALITY_PRIOR_FLOOR = 0.85
AUTHOR_QUALITY_PRIOR_RANGE = 0.3
COMPLETION_NEUTRAL_RATE = 0.5
COMPLETION_INFLUENCE = 0.3
MAXIMUM_EXPLANATIONS = 3


@dataclass(frozen=True, slots=True)
class SafetyFilterOutcome:
    kept_candidates: list[FeedCandidate]
    excluded_items: list[ExcludedItem]


def filter_candidates_for_viewer_safety(
    candidates: Sequence[FeedCandidate], viewer: ViewerContext
) -> SafetyFilterOutcome:
    viewer_is_adult = viewer.age_bracket in ADULT_AGE_BRACKETS
    kept: list[FeedCandidate] = []
    excluded: list[ExcludedItem] = []
    for candidate in candidates:
        if candidate.age_restricted and not viewer_is_adult:
            excluded.append(ExcludedItem(item_id=candidate.item_id, reason="age_restricted"))
        elif candidate.is_sensitive and not viewer_is_adult:
            excluded.append(ExcludedItem(item_id=candidate.item_id, reason="sensitive_for_viewer"))
        else:
            kept.append(candidate)
    return SafetyFilterOutcome(kept, excluded)


UNKNOWN_INTEGRITY_ASSESSMENT = IntegrityAssessment(
    trusted_engagement_share=0.7, manipulated=False, suspicion_score=0.0, reasons=("integrity_unavailable",)
)


def assess_candidate_integrity(
    candidates: Sequence[FeedCandidate],
    item_statistics_by_item: dict[str, dict[str, float]],
    online_counters_available: bool = True,
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


def discount_candidate_engagement(candidate: FeedCandidate, assessment: IntegrityAssessment) -> FeedCandidate:
    return candidate.model_copy(
        update={
            "like_count": discount_engagement_count(
                candidate.like_count + SAVE_WEIGHT_IN_LIKES * candidate.save_count, assessment
            ),
            "comment_count": discount_engagement_count(candidate.comment_count, assessment),
            "share_count": discount_engagement_count(candidate.share_count + candidate.repost_count, assessment),
            "author_is_verified": False,
        }
    )


def calculate_quality_multiplier(candidate: FeedCandidate) -> float:
    prior_multiplier = AUTHOR_QUALITY_PRIOR_FLOOR + AUTHOR_QUALITY_PRIOR_RANGE * candidate.author_quality_prior
    if candidate.completion_rate is None:
        return prior_multiplier
    completion_multiplier = 1.0 + COMPLETION_INFLUENCE * (candidate.completion_rate - COMPLETION_NEUTRAL_RATE)
    return prior_multiplier * completion_multiplier


def apply_quality_and_capped_boosts(
    scores: dict[str, float], candidates: Sequence[FeedCandidate], clamped_policy: RankingBoostPolicy
) -> tuple[dict[str, float], dict[str, float]]:
    adjusted: dict[str, float] = {}
    boosts: dict[str, float] = {}
    for candidate in candidates:
        if candidate.item_id not in scores:
            continue
        boost = calculate_capped_author_boost(candidate.author_tier, candidate.author_is_official, clamped_policy)
        boosts[candidate.item_id] = boost
        adjusted[candidate.item_id] = scores[candidate.item_id] * calculate_quality_multiplier(candidate) * boost
    return adjusted, boosts


def describe_boost_percentage(boost: float) -> str:
    return f"{round((boost - 1.0) * 100)}%"


def build_ranking_explanations(
    candidate: FeedCandidate, features: dict[str, float], trending_topics: frozenset[str], boost: float
) -> list[RankingExplanation]:
    explanations: list[RankingExplanation] = []
    if candidate.is_promoted:
        explanations.append(RankingExplanation(code="promoted", label="Promoted"))
    if features["viewer_follows_author"] > 0:
        explanations.append(RankingExplanation(code="following", label="You follow this account"))
    trending_tag = next((tag for tag in [*candidate.hashtags, *candidate.topics] if tag in trending_topics), None)
    if trending_tag is not None:
        explanations.append(
            RankingExplanation(code="trending_topic", label=f"Trending: #{trending_tag}", detail=trending_tag)
        )
    if features["creator_affinity"] > 0.3 or features["topic_affinity_max"] > 0.3:
        explanations.append(RankingExplanation(code="similar_to_liked", label="Similar to posts you liked"))
    if features["friend_engagement_count"] > 0:
        explanations.append(RankingExplanation(code="friends_engaged", label="People you know engaged"))
    if features["same_country_as_viewer"] > 0 and features["like_rate"] > 0.05:
        explanations.append(RankingExplanation(code="popular_near_you", label="Popular near you"))
    if not explanations and features["like_rate"] > 0.1:
        explanations.append(RankingExplanation(code="popular", label="Popular right now"))
    if not explanations and features["age_hours"] < 6:
        explanations.append(RankingExplanation(code="fresh", label="New post"))
    explanations = explanations[:MAXIMUM_EXPLANATIONS]
    if boost > 1.0:
        code = "official_boost" if candidate.author_is_official else "checkmark_boost"
        label = "Official account" if candidate.author_is_official else "Checkmark account"
        explanations.append(
            RankingExplanation(
                code=code,
                label=label,
                detail=f"Gets a disclosed ranking boost of {describe_boost_percentage(boost)}, capped for everyone",
            )
        )
    return explanations
