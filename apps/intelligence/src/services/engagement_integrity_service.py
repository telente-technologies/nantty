from dataclasses import dataclass

from src.modules.feed.dtos.feed_fairness_dto import EngagementIntegritySignals

MINIMUM_ENGAGERS_FOR_MANIPULATION_FLAG = 10
MANIPULATED_SUSPICIOUS_SHARE = 0.5
BURST_SUSPICION_THRESHOLD = 0.6
POD_SUSPICION_THRESHOLD = 0.5
MINIMUM_TRUSTED_SHARE = 0.05
SPAM_HASHTAG_PENALTY_PER_TAG = 0.15
MAXIMUM_SPAM_HASHTAG_PENALTY = 0.6


@dataclass(frozen=True, slots=True)
class IntegrityAssessment:
    trusted_engagement_share: float
    manipulated: bool
    suspicion_score: float
    reasons: tuple[str, ...]


def combine_online_integrity_counters(
    signals: EngagementIntegritySignals | None, item_statistics: dict[str, float]
) -> EngagementIntegritySignals:
    base = signals or EngagementIntegritySignals()
    engagements = item_statistics.get("integrity_engagements", 0.0)
    if engagements <= 0:
        return base
    low_trust_share = min(item_statistics.get("integrity_low_trust", 0.0) / engagements, 1.0)
    clustered_share = min(item_statistics.get("integrity_clustered", 0.0) / engagements, 1.0)
    return base.model_copy(
        update={
            "engager_count": max(base.engager_count, int(engagements)),
            "low_trust_engager_share": max(base.low_trust_engager_share, low_trust_share),
            "clustered_engager_share": max(base.clustered_engager_share, clustered_share),
        }
    )


def assess_engagement_integrity(signals: EngagementIntegritySignals) -> IntegrityAssessment:
    reasons: list[str] = []
    excluded_share = min(
        1.0,
        signals.suspended_engager_share
        + 0.75 * signals.new_account_engager_share
        + 0.75 * signals.low_trust_engager_share
        + 0.9 * signals.clustered_engager_share
        + 0.6 * signals.reciprocal_pod_share,
    )
    if signals.new_account_engager_share >= 0.3:
        reasons.append("new_account_engagement")
    if signals.low_trust_engager_share >= 0.3:
        reasons.append("low_trust_engagement")
    if signals.suspended_engager_share >= 0.1:
        reasons.append("suspended_engagers")
    if signals.clustered_engager_share >= 0.3:
        reasons.append("coordinated_cluster")
    if signals.reciprocal_pod_share >= POD_SUSPICION_THRESHOLD:
        reasons.append("reciprocal_pod")
    burst_suspicious = signals.burst_ratio >= BURST_SUSPICION_THRESHOLD
    if burst_suspicious:
        reasons.append("engagement_burst")
        excluded_share = min(1.0, excluded_share + 0.25 * signals.burst_ratio)
    if signals.purchased_engagement_suspected:
        reasons.append("purchased_engagement")
        excluded_share = max(excluded_share, 0.8)
    spam_penalty = min(signals.spam_hashtag_count * SPAM_HASHTAG_PENALTY_PER_TAG, MAXIMUM_SPAM_HASHTAG_PENALTY)
    if signals.spam_hashtag_count:
        reasons.append("spam_hashtags")
    trusted_share = max((1.0 - excluded_share) * (1.0 - spam_penalty), MINIMUM_TRUSTED_SHARE)
    enough_engagers = signals.engager_count >= MINIMUM_ENGAGERS_FOR_MANIPULATION_FLAG
    manipulated = enough_engagers and (
        excluded_share >= MANIPULATED_SUSPICIOUS_SHARE or signals.purchased_engagement_suspected
    )
    return IntegrityAssessment(
        trusted_engagement_share=round(trusted_share, 6),
        manipulated=manipulated,
        suspicion_score=round(min(1.0, excluded_share + spam_penalty), 6),
        reasons=tuple(reasons),
    )


def discount_engagement_count(count: int, assessment: IntegrityAssessment) -> int:
    return round(count * assessment.trusted_engagement_share)
