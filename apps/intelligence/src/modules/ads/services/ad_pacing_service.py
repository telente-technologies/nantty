from datetime import datetime, timedelta

from src.modules.ads.dtos.ad_selection_dto import AdCandidate
from src.utils.decay_math_util import hash_text_to_unit_interval

PACING_HEADROOM_FRACTION = 0.02
PACING_OVERSHOOT_SENSITIVITY = 20.0
MINUTES_PER_DAY = 1440.0


def calculate_day_progress_fraction(now: datetime, day_start_utc_offset_minutes: int) -> float:
    local_moment = now + timedelta(minutes=day_start_utc_offset_minutes)
    minutes_since_local_midnight = local_moment.hour * 60 + local_moment.minute + local_moment.second / 60.0
    return min(max(minutes_since_local_midnight / MINUTES_PER_DAY, 0.0), 1.0)


def calculate_maximum_single_charge_minor(candidate: AdCandidate) -> int:
    if candidate.bid_type == "cpc":
        return candidate.bid.amount_minor
    return -(-candidate.bid.amount_minor // 1000)


def has_budget_for_one_more_charge(
    candidate: AdCandidate, effective_spent_today_minor: int, effective_spent_total_minor: int
) -> bool:
    maximum_single_charge = calculate_maximum_single_charge_minor(candidate)
    remaining_daily_budget = candidate.daily_budget.amount_minor - effective_spent_today_minor
    if maximum_single_charge > remaining_daily_budget:
        return False
    if candidate.total_budget is not None:
        remaining_total_budget = candidate.total_budget.amount_minor - effective_spent_total_minor
        if maximum_single_charge > remaining_total_budget:
            return False
    return True


def calculate_pacing_participation_probability(
    daily_budget_minor: int, spent_today_minor: int, day_progress_fraction: float
) -> float:
    if daily_budget_minor <= 0:
        return 0.0
    target_spend_so_far = daily_budget_minor * min(day_progress_fraction + PACING_HEADROOM_FRACTION, 1.0)
    if spent_today_minor <= target_spend_so_far:
        return 1.0
    overshoot_fraction = (spent_today_minor - target_spend_so_far) / daily_budget_minor
    return max(0.0, 1.0 - overshoot_fraction * PACING_OVERSHOOT_SENSITIVITY)


def should_campaign_participate_in_auction(
    candidate: AdCandidate, effective_spent_today_minor: int, now: datetime, auction_id: str
) -> bool:
    participation_probability = calculate_pacing_participation_probability(
        candidate.daily_budget.amount_minor,
        effective_spent_today_minor,
        calculate_day_progress_fraction(now, candidate.day_start_utc_offset_minutes),
    )
    if participation_probability >= 1.0:
        return True
    random_draw = hash_text_to_unit_interval(f"{auction_id}:{candidate.campaign_id}")
    return random_draw < participation_probability
