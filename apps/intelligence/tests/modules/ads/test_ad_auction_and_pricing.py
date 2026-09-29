from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from src.dtos.common_dto import ExchangeRateToUsd, ViewerContext
from src.modules.ads.dtos.ad_selection_dto import AdCandidate
from src.modules.ads.services.ad_auction_service import (
    AuctionEntry,
    calculate_effective_cpm_usd_micros,
    run_generalized_second_price_auction,
)
from src.modules.ads.services.ad_eligibility_service import AdEligibilityContext, EligibleAd, evaluate_ad_eligibility
from src.services.currency_conversion_service import build_usd_rate_lookup, convert_money_to_usd_micros

NAIRA_TO_USD_RATES = build_usd_rate_lookup([ExchangeRateToUsd(currency="NGN", usd_per_major_unit=Decimal("0.00065"))])


def build_ad_candidate(
    ad_id: str, advertiser_id: str, bid_type: str, bid_minor: int, currency: str = "USD", **overrides: Any
) -> AdCandidate:
    return AdCandidate.model_validate(
        {
            "adId": ad_id,
            "campaignId": f"campaign_{ad_id}",
            "advertiserId": advertiser_id,
            "status": "active",
            "bidType": bid_type,
            "bid": {"amountMinor": bid_minor, "currency": currency},
            "dailyBudget": {"amountMinor": 10_000_000_000, "currency": currency},
            "spentToday": {"amountMinor": 0, "currency": currency},
            "spentTotal": {"amountMinor": 0, "currency": currency},
            "placements": ["feed"],
            "creative": {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 15000},
            **overrides,
        }
    )


def build_auction_entry(candidate: AdCandidate, predicted_click_rate: float) -> AuctionEntry:
    bid_usd_micros = convert_money_to_usd_micros(candidate.bid, NAIRA_TO_USD_RATES)
    assert bid_usd_micros is not None
    eligible_ad = EligibleAd(candidate, bid_usd_micros, 0.0)
    return AuctionEntry(
        eligible_ad, predicted_click_rate, calculate_effective_cpm_usd_micros(eligible_ad, predicted_click_rate)
    )


def build_eligibility_context(usd_rate_lookup: dict[str, Decimal]) -> AdEligibilityContext:
    return AdEligibilityContext(
        viewer=ViewerContext(user_id="viewer_1", country="NG"),
        placement="feed",
        now=datetime(2026, 9, 29, 0, 30, tzinfo=UTC),
        auction_id="auction_1",
        usd_rate_lookup=usd_rate_lookup,
        viewer_interest_topics=frozenset(),
        viewer_topic_affinity={},
        impressions_today_by_campaign={},
        online_spend_today_by_campaign={},
        store_customer_topic_centroids={},
    )


def test_cost_per_click_winner_pays_next_effective_cpm_divided_by_own_click_rate_plus_one_minor_unit() -> None:
    first = build_auction_entry(build_ad_candidate("ad_a", "advertiser_a", "cpc", 100), 0.05)
    second = build_auction_entry(build_ad_candidate("ad_b", "advertiser_b", "cpc", 200), 0.01)
    outcome = run_generalized_second_price_auction([second, first], 2, Decimal(0), NAIRA_TO_USD_RATES)
    assert [winner.entry.eligible_ad.candidate.ad_id for winner in outcome.winners] == ["ad_a", "ad_b"]
    assert outcome.winners[0].clearing_price_minor == 41
    assert outcome.winners[1].clearing_price_minor == 1


def test_cost_per_mille_winner_pays_next_effective_cpm_plus_one_minor_unit() -> None:
    first = build_auction_entry(build_ad_candidate("ad_a", "advertiser_a", "cpm", 500), 0.01)
    second = build_auction_entry(build_ad_candidate("ad_b", "advertiser_b", "cpm", 300), 0.01)
    outcome = run_generalized_second_price_auction([first, second], 1, Decimal(0), NAIRA_TO_USD_RATES)
    assert outcome.winners[0].clearing_price_minor == 301
    assert outcome.losing_reasons == {"ad_b": "outbid"}


def test_clearing_price_is_capped_at_the_winner_bid() -> None:
    first = build_auction_entry(build_ad_candidate("ad_a", "advertiser_a", "cpc", 100), 0.02)
    second = build_auction_entry(build_ad_candidate("ad_b", "advertiser_b", "cpm", 1999), 0.01)
    outcome = run_generalized_second_price_auction([first, second], 2, Decimal(0), NAIRA_TO_USD_RATES)
    assert outcome.winners[0].entry.eligible_ad.candidate.ad_id == "ad_a"
    assert outcome.winners[0].clearing_price_minor == 100


def test_lone_winner_pays_reserve_price_or_one_minor_unit() -> None:
    lone_entry = build_auction_entry(build_ad_candidate("ad_a", "advertiser_a", "cpm", 900), 0.01)
    without_reserve = run_generalized_second_price_auction([lone_entry], 3, Decimal(0), NAIRA_TO_USD_RATES)
    with_reserve = run_generalized_second_price_auction([lone_entry], 3, Decimal(2_000_000), NAIRA_TO_USD_RATES)
    assert without_reserve.winners[0].clearing_price_minor == 1
    assert with_reserve.winners[0].clearing_price_minor == 200


def test_clearing_price_never_exceeds_bid_across_many_random_auctions() -> None:
    entries = [
        build_auction_entry(
            build_ad_candidate(f"ad_{index}", f"advertiser_{index}", "cpc" if index % 2 else "cpm", 50 + index * 37),
            0.005 + (index % 7) * 0.01,
        )
        for index in range(25)
    ]
    outcome = run_generalized_second_price_auction(entries, 10, Decimal(100_000), NAIRA_TO_USD_RATES)
    assert len(outcome.winners) == 10
    for winner in outcome.winners:
        assert 1 <= winner.clearing_price_minor <= winner.entry.eligible_ad.candidate.bid.amount_minor


def test_only_the_best_ad_per_advertiser_enters_the_auction() -> None:
    best = build_auction_entry(build_ad_candidate("ad_best", "advertiser_same", "cpm", 800), 0.01)
    weaker = build_auction_entry(build_ad_candidate("ad_weaker", "advertiser_same", "cpm", 400), 0.01)
    outcome = run_generalized_second_price_auction([weaker, best], 5, Decimal(0), NAIRA_TO_USD_RATES)
    assert [winner.entry.eligible_ad.candidate.ad_id for winner in outcome.winners] == ["ad_best"]
    assert outcome.losing_reasons["ad_weaker"] == "advertiser_already_competing"


def test_ads_below_reserve_are_rejected() -> None:
    cheap = build_auction_entry(build_ad_candidate("ad_cheap", "advertiser_a", "cpm", 300), 0.01)
    outcome = run_generalized_second_price_auction([cheap], 2, Decimal(4_000_000), NAIRA_TO_USD_RATES)
    assert outcome.winners == []
    assert outcome.losing_reasons == {"ad_cheap": "below_reserve"}


def test_naira_bid_worth_more_dollars_beats_dollar_bid_and_is_charged_in_naira() -> None:
    naira_entry = build_auction_entry(build_ad_candidate("ad_naira", "advertiser_ng", "cpm", 1_000_000, "NGN"), 0.01)
    dollar_entry = build_auction_entry(build_ad_candidate("ad_usd", "advertiser_us", "cpm", 500), 0.01)
    outcome = run_generalized_second_price_auction([dollar_entry, naira_entry], 1, Decimal(0), NAIRA_TO_USD_RATES)
    winner = outcome.winners[0]
    assert winner.entry.eligible_ad.candidate.ad_id == "ad_naira"
    assert winner.entry.eligible_ad.candidate.bid.currency == "NGN"
    assert winner.clearing_price_minor == 769_232
    assert winner.clearing_price_minor <= 1_000_000


def test_missing_exchange_rate_makes_ad_ineligible() -> None:
    candidate = build_ad_candidate("ad_ghana", "advertiser_gh", "cpm", 500, "GHS")
    outcome = evaluate_ad_eligibility(candidate, build_eligibility_context(NAIRA_TO_USD_RATES))
    assert outcome == "missing_exchange_rate"


def test_currency_mismatch_between_bid_and_budget_makes_ad_ineligible() -> None:
    candidate = build_ad_candidate(
        "ad_mixed", "advertiser_mixed", "cpm", 500, dailyBudget={"amountMinor": 1_000_000, "currency": "NGN"}
    )
    outcome = evaluate_ad_eligibility(candidate, build_eligibility_context(NAIRA_TO_USD_RATES))
    assert outcome == "currency_mismatch"


def test_eligible_naira_ad_converts_bid_to_usd_micros() -> None:
    candidate = build_ad_candidate("ad_naira", "advertiser_ng", "cpc", 10_000, "NGN")
    outcome = evaluate_ad_eligibility(candidate, build_eligibility_context(NAIRA_TO_USD_RATES))
    assert isinstance(outcome, EligibleAd)
    assert outcome.bid_usd_micros == Decimal("65000.00000")
