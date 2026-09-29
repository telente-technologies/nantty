from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from src.dtos.common_dto import ViewerContext
from src.modules.ads.dtos.ad_selection_dto import AdCandidate, AdPlacement
from src.modules.ads.services.ad_feature_vector_service import calculate_cosine_similarity
from src.modules.ads.services.ad_pacing_service import (
    has_budget_for_one_more_charge,
    should_campaign_participate_in_auction,
)
from src.modules.ads.validators.ad_creative_validator import find_creative_format_violation
from src.services.currency_conversion_service import (
    CurrencyMismatchError,
    convert_money_to_usd_micros,
    ensure_same_currency,
)


@dataclass(frozen=True, slots=True)
class AdEligibilityContext:
    viewer: ViewerContext
    placement: AdPlacement
    now: datetime
    auction_id: str
    usd_rate_lookup: dict[str, Decimal]
    viewer_interest_topics: frozenset[str]
    viewer_topic_affinity: Mapping[str, float]
    impressions_today_by_campaign: Mapping[str, float]
    online_spend_today_by_campaign: Mapping[str, Mapping[str, float]]
    store_customer_topic_centroids: Mapping[str, Mapping[str, float]]


@dataclass(frozen=True, slots=True)
class EligibleAd:
    candidate: AdCandidate
    bid_usd_micros: Decimal
    lookalike_similarity: float


def check_schedule_and_status(candidate: AdCandidate, context: AdEligibilityContext) -> str | None:
    if candidate.status != "active":
        return "not_active"
    if context.placement not in candidate.placements:
        return "placement_not_targeted"
    if candidate.starts_at is not None and context.now < candidate.starts_at:
        return "outside_schedule"
    if candidate.ends_at is not None and context.now >= candidate.ends_at:
        return "outside_schedule"
    advertiser_hidden = {*context.viewer.blocked_account_ids, *context.viewer.muted_account_ids}
    if candidate.advertiser_id in advertiser_hidden:
        return "advertiser_blocked_by_viewer"
    return None


def check_audience_targeting(candidate: AdCandidate, context: AdEligibilityContext) -> tuple[str | None, float]:
    targeting = candidate.targeting
    viewer = context.viewer
    if targeting.countries and viewer.country not in targeting.countries:
        return "geo_mismatch", 0.0
    if targeting.regions and viewer.region not in targeting.regions:
        return "geo_mismatch", 0.0
    if targeting.age_brackets and viewer.age_bracket not in targeting.age_brackets:
        return "age_mismatch", 0.0
    if targeting.topics and not (set(targeting.topics) & context.viewer_interest_topics):
        return "interest_mismatch", 0.0
    lookalike_similarity = 0.0
    if targeting.lookalike_store_id is not None:
        centroid = context.store_customer_topic_centroids.get(targeting.lookalike_store_id)
        if not centroid:
            return "lookalike_audience_unavailable", 0.0
        lookalike_similarity = calculate_cosine_similarity(context.viewer_topic_affinity, centroid)
        if lookalike_similarity < targeting.lookalike_minimum_similarity:
            return "lookalike_mismatch", lookalike_similarity
    return None, lookalike_similarity


def read_effective_spend_minor(
    candidate: AdCandidate, online_spend_by_currency: Mapping[str, float]
) -> tuple[int, int]:
    online_spend_today = int(online_spend_by_currency.get(candidate.bid.currency, 0.0))
    effective_spent_today = max(candidate.spent_today.amount_minor, online_spend_today)
    unseen_online_spend = max(online_spend_today - candidate.spent_today.amount_minor, 0)
    effective_spent_total = candidate.spent_total.amount_minor + unseen_online_spend
    return effective_spent_today, effective_spent_total


def evaluate_ad_eligibility(candidate: AdCandidate, context: AdEligibilityContext) -> EligibleAd | str:
    status_failure = check_schedule_and_status(candidate, context)
    if status_failure is not None:
        return status_failure
    format_failure = find_creative_format_violation(candidate.creative, context.placement)
    if format_failure is not None:
        return format_failure
    try:
        ensure_same_currency(
            candidate.bid, candidate.daily_budget, candidate.total_budget, candidate.spent_today, candidate.spent_total
        )
    except CurrencyMismatchError:
        return "currency_mismatch"
    bid_usd_micros = convert_money_to_usd_micros(candidate.bid, context.usd_rate_lookup)
    if bid_usd_micros is None:
        return "missing_exchange_rate"
    if bid_usd_micros <= 0:
        return "zero_bid"
    effective_spent_today, effective_spent_total = read_effective_spend_minor(
        candidate, context.online_spend_today_by_campaign.get(candidate.campaign_id, {})
    )
    if not has_budget_for_one_more_charge(candidate, effective_spent_today, effective_spent_total):
        return "budget_exhausted"
    impressions_today = context.impressions_today_by_campaign.get(candidate.campaign_id, 0.0)
    if impressions_today >= candidate.frequency_cap_per_day:
        return "frequency_capped"
    targeting_failure, lookalike_similarity = check_audience_targeting(candidate, context)
    if targeting_failure is not None:
        return targeting_failure
    if not should_campaign_participate_in_auction(candidate, effective_spent_today, context.now, context.auction_id):
        return "paced_out"
    return EligibleAd(candidate, bid_usd_micros, lookalike_similarity)
