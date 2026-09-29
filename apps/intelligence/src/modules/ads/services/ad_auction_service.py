from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from src.modules.ads.services.ad_eligibility_service import EligibleAd
from src.services.currency_conversion_service import convert_usd_micros_to_minor_amount

MILLE = Decimal(1000)


@dataclass(frozen=True, slots=True)
class AuctionEntry:
    eligible_ad: EligibleAd
    predicted_click_rate: float
    effective_cpm_usd_micros: Decimal


@dataclass(frozen=True, slots=True)
class AuctionWinner:
    entry: AuctionEntry
    rank: int
    clearing_price_minor: int


@dataclass(frozen=True, slots=True)
class AuctionOutcome:
    winners: list[AuctionWinner]
    losing_reasons: dict[str, str]


def calculate_effective_cpm_usd_micros(eligible_ad: EligibleAd, predicted_click_rate: float) -> Decimal:
    if eligible_ad.candidate.bid_type == "cpm":
        return eligible_ad.bid_usd_micros
    return eligible_ad.bid_usd_micros * Decimal(str(predicted_click_rate)) * MILLE


def calculate_generalized_second_price_in_usd_micros(
    winner_entry: AuctionEntry, next_effective_cpm_usd_micros: Decimal
) -> Decimal:
    if winner_entry.eligible_ad.candidate.bid_type == "cpm":
        return next_effective_cpm_usd_micros
    click_rate = Decimal(str(max(winner_entry.predicted_click_rate, 1e-9)))
    return next_effective_cpm_usd_micros / (click_rate * MILLE)


def convert_clearing_price_to_bid_currency(
    winner_entry: AuctionEntry,
    price_usd_micros: Decimal,
    usd_rate_lookup: dict[str, Decimal],
    has_real_competitor: bool,
) -> int:
    candidate = winner_entry.eligible_ad.candidate
    converted_minor = convert_usd_micros_to_minor_amount(
        price_usd_micros, candidate.bid.currency, usd_rate_lookup, round_up=True
    )
    minimum_increment = 1 if has_real_competitor else 0
    price_minor = max((converted_minor or 0) + minimum_increment, 1)
    return min(price_minor, candidate.bid.amount_minor)


def run_generalized_second_price_auction(
    entries: Sequence[AuctionEntry],
    slot_count: int,
    reserve_cpm_usd_micros: Decimal,
    usd_rate_lookup: dict[str, Decimal],
) -> AuctionOutcome:
    losing_reasons: dict[str, str] = {}
    qualified_entries: list[AuctionEntry] = []
    for entry in entries:
        if entry.effective_cpm_usd_micros < reserve_cpm_usd_micros or entry.effective_cpm_usd_micros <= 0:
            losing_reasons[entry.eligible_ad.candidate.ad_id] = "below_reserve"
        else:
            qualified_entries.append(entry)
    ranked_entries = sorted(
        qualified_entries,
        key=lambda entry: (-entry.effective_cpm_usd_micros, entry.eligible_ad.candidate.ad_id),
    )
    unique_entries: list[AuctionEntry] = []
    seen_advertisers: set[str] = set()
    for entry in ranked_entries:
        advertiser_id = entry.eligible_ad.candidate.advertiser_id
        if advertiser_id in seen_advertisers:
            losing_reasons[entry.eligible_ad.candidate.ad_id] = "advertiser_already_competing"
            continue
        seen_advertisers.add(advertiser_id)
        unique_entries.append(entry)
    winners: list[AuctionWinner] = []
    for rank, entry in enumerate(unique_entries):
        if rank >= slot_count:
            losing_reasons[entry.eligible_ad.candidate.ad_id] = "outbid"
            continue
        has_real_competitor = rank + 1 < len(unique_entries)
        next_effective_cpm = (
            unique_entries[rank + 1].effective_cpm_usd_micros if has_real_competitor else reserve_cpm_usd_micros
        )
        price_usd_micros = calculate_generalized_second_price_in_usd_micros(entry, next_effective_cpm)
        clearing_price_minor = convert_clearing_price_to_bid_currency(
            entry, price_usd_micros, usd_rate_lookup, has_real_competitor
        )
        winners.append(AuctionWinner(entry, rank, clearing_price_minor))
    return AuctionOutcome(winners, losing_reasons)
