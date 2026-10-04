from src.modules.verification_eligibility.dtos.verification_eligibility_dto import (
    EligibilityTier,
    VerificationEligibilityRequest,
    VerificationEligibilityResponse,
)

BUY_NOW_SCORE = 75
BUY_NOW_MAXIMUM_FRAUD_SCORE = 40
BLOCKING_FRAUD_SCORE = 80
BLOCKING_RISK_SCORE = 85
SCORING_SOURCE = "verification_trust:heuristic_v1"
HARD_REQUIREMENTS = frozenset(
    {
        "account_age_below_threshold",
        "recent_violation",
        "high_fraud_score",
        "real_followers_below_threshold",
        "completed_orders_below_threshold",
        "no_active_store_or_brand_page",
    }
)


def ratio(value: int, target: int) -> float:
    return 1.0 if target <= 0 else min(value / target, 1.0)


def score_audience_and_activity(request: VerificationEligibilityRequest, reasons: list[str]) -> float:
    thresholds = request.thresholds
    if request.color == "gold":
        if request.completed_orders < thresholds.minimum_completed_orders:
            reasons.append("completed_orders_below_threshold")
        if request.success_rate_percent < thresholds.minimum_success_rate_percent:
            reasons.append("success_rate_below_threshold")
        if not request.has_active_store_or_brand_page:
            reasons.append("no_active_store_or_brand_page")
        audience = 10 * ratio(request.completed_orders, thresholds.minimum_completed_orders)
        audience += 10 * ratio(request.success_rate_percent, thresholds.minimum_success_rate_percent)
        return audience + (15 if request.has_active_store_or_brand_page else 0)
    if request.real_followers < thresholds.minimum_real_followers:
        reasons.append("real_followers_below_threshold")
    if request.original_posts_last60_days < 3:
        reasons.append("low_recent_activity")
    return 20 * ratio(request.real_followers, thresholds.minimum_real_followers) + 15 * ratio(
        request.original_posts_last60_days, 10
    )


def score_verification_trust(request: VerificationEligibilityRequest) -> VerificationEligibilityResponse:
    thresholds = request.thresholds
    reasons: list[str] = []
    score = 15.0 + 20 * ratio(request.account_age_days, thresholds.minimum_account_age_days)
    if request.account_age_days < thresholds.minimum_account_age_days:
        reasons.append("account_age_below_threshold")
    score += score_audience_and_activity(request, reasons)
    score += 20 * ratio(request.days_since_last_violation, thresholds.no_violations_in_days)
    if request.days_since_last_violation < thresholds.no_violations_in_days:
        reasons.append("recent_violation")
    score += (7 if request.phone_verified else 0) + (3 if request.email_verified else 0)
    if not request.phone_verified:
        reasons.append("phone_not_verified")
    if request.borderline_content:
        score -= 5
        reasons.append("borderline_content")
    score -= request.fraud_score * 0.5 + request.risk_score * 0.3
    if request.fraud_score >= BUY_NOW_MAXIMUM_FRAUD_SCORE:
        reasons.append("high_fraud_score")
    trust_score = round(max(0.0, min(score, 100.0)))
    tier: EligibilityTier = "request"
    hard_requirements_met = not HARD_REQUIREMENTS & set(reasons)
    if (
        request.account_restricted
        or request.fraud_score >= BLOCKING_FRAUD_SCORE
        or request.risk_score >= BLOCKING_RISK_SCORE
    ):
        tier = "blocked"
        reasons.insert(0, "account_restricted" if request.account_restricted else "fraud_or_bot_signals")
    elif trust_score >= BUY_NOW_SCORE and hard_requirements_met:
        tier = "buy_now"
    recheck_after_hours = {"buy_now": 0, "request": 24 if trust_score >= 60 else 72, "blocked": 168}[tier]
    return VerificationEligibilityResponse(
        profile_id=request.profile_id,
        trust_score=trust_score,
        tier=tier,
        reasons=reasons,
        recheck_after_hours=recheck_after_hours,
        scoring_source=SCORING_SOURCE,
    )


class VerificationTrustScoringService:
    async def assess(self, request: VerificationEligibilityRequest) -> VerificationEligibilityResponse:
        return score_verification_trust(request)
