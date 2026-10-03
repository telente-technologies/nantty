import math
from collections import Counter

from src.dtos.common_dto import RankingResponseMetadata
from src.modules.creator_eligibility.dtos.real_followers_dto import (
    FollowerSignals,
    RealFollowersRequest,
    RealFollowersResponse,
)
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time

BASE_AUTHENTICITY = 0.92
SUSPICIOUS_AUTHENTICITY_THRESHOLD = 0.4
LOWER_BOUND_Z_SCORE = 1.645


def estimate_follower_authenticity(follower: FollowerSignals) -> tuple[float, list[str]]:
    probability = BASE_AUTHENTICITY
    reasons: list[str] = []

    def penalise(code: str, multiplier: float, triggered: bool) -> None:
        nonlocal probability
        if triggered:
            probability *= multiplier
            reasons.append(code)

    penalise("account_younger_than_week", 0.5, follower.account_age_days < 7)
    penalise("account_younger_than_month", 0.8, 7 <= follower.account_age_days < 30)
    penalise("no_profile_photo", 0.8, not follower.has_profile_photo)
    penalise("no_activity", 0.6, follower.post_count == 0 and follower.active_days_last_30 <= 1)
    penalise("mass_following_account", 0.5, follower.followed_account_count >= 2000)
    penalise("shared_device_cluster", 0.4, follower.device_cluster_size >= 5)
    penalise("signup_burst_member", 0.5, follower.signup_burst_size >= 20)
    penalise("phone_not_verified", 0.9, not follower.phone_verified)
    return probability, reasons


class RealFollowersEstimationService:
    async def estimate_real_followers(self, request: RealFollowersRequest) -> RealFollowersResponse:
        probabilities: list[float] = []
        reason_counter: Counter[str] = Counter()
        for follower in request.followers:
            probability, reasons = estimate_follower_authenticity(follower)
            probabilities.append(probability)
            reason_counter.update(reasons)
        sampled = len(probabilities)
        ratio = sum(probabilities) / sampled if sampled else 0.0
        total = request.total_follower_count if request.total_follower_count is not None else sampled
        variance_of_ratio = sum(p * (1 - p) for p in probabilities) / (sampled**2) if sampled else 0.0
        lower_ratio = max(ratio - LOWER_BOUND_Z_SCORE * math.sqrt(variance_of_ratio), 0.0)
        is_scaled_sample = total > sampled > 0
        if is_scaled_sample:
            lower_ratio = max(ratio - LOWER_BOUND_Z_SCORE * math.sqrt(ratio * (1 - ratio) / sampled), 0.0)
        return RealFollowersResponse(
            creator_id=request.creator_id,
            sampled_followers=sampled,
            estimated_real_ratio=round(ratio, 6),
            estimated_real_followers=round(ratio * total),
            real_followers_lower_bound=math.floor(lower_ratio * total),
            suspicious_followers=sum(1 for p in probabilities if p < SUSPICIOUS_AUTHENTICITY_THRESHOLD),
            top_reasons=[code for code, _count in reason_counter.most_common(5)],
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="real_followers:heuristic",
                generated_at=resolve_request_time(request.now),
            ),
        )
