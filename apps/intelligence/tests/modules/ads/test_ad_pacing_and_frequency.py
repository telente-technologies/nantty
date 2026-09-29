from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from src.container import ApplicationContainer
from src.dtos.common_dto import ViewerContext
from src.modules.ads.dtos.ad_selection_dto import AdCandidate, AdSelectionRequest
from src.modules.ads.services.ad_eligibility_service import AdEligibilityContext, EligibleAd, evaluate_ad_eligibility
from src.modules.ads.services.ad_pacing_service import (
    calculate_day_progress_fraction,
    calculate_pacing_participation_probability,
    has_budget_for_one_more_charge,
)
from tests.conftest import build_event, build_viewer

DAY_START = datetime(2026, 9, 28, 0, 0, tzinfo=UTC)


def build_campaign(bid_type: str, bid_minor: int, daily_budget_minor: int, **overrides: Any) -> AdCandidate:
    return AdCandidate.model_validate(
        {
            "adId": "ad_paced",
            "campaignId": "campaign_paced",
            "advertiserId": "advertiser_paced",
            "status": "active",
            "bidType": bid_type,
            "bid": {"amountMinor": bid_minor, "currency": "USD"},
            "dailyBudget": {"amountMinor": daily_budget_minor, "currency": "USD"},
            "spentToday": {"amountMinor": 0, "currency": "USD"},
            "spentTotal": {"amountMinor": 0, "currency": "USD"},
            "placements": ["feed"],
            "creative": {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 15000},
            "dayStartUtcOffsetMinutes": 0,
            "frequencyCapPerDay": 50,
            **overrides,
        }
    )


def build_context(now: datetime, auction_id: str) -> AdEligibilityContext:
    return AdEligibilityContext(
        viewer=ViewerContext(user_id="viewer_1"),
        placement="feed",
        now=now,
        auction_id=auction_id,
        usd_rate_lookup={"USD": Decimal(1)},
        viewer_interest_topics=frozenset(),
        viewer_topic_affinity={},
        impressions_today_by_campaign={},
        online_spend_today_by_campaign={},
        store_customer_topic_centroids={},
    )


def test_simulated_day_of_auctions_never_overspends_and_spreads_spend_smoothly() -> None:
    daily_budget = 20_000
    spent_today = 0
    spend_at_midday = 0
    for minute in range(1440):
        if minute == 720:
            spend_at_midday = spent_today
        for auction_index in range(20):
            campaign = build_campaign(
                "cpm", 1000, daily_budget, spentToday={"amountMinor": spent_today, "currency": "USD"}
            )
            now = DAY_START + timedelta(minutes=minute, seconds=auction_index * 3)
            outcome = evaluate_ad_eligibility(campaign, build_context(now, f"auction_{minute}_{auction_index}"))
            if isinstance(outcome, EligibleAd):
                spent_today += -(-campaign.bid.amount_minor // 1000)
            assert spent_today <= daily_budget
    assert spent_today <= daily_budget
    assert spend_at_midday <= 0.6 * daily_budget
    assert spent_today >= 0.8 * daily_budget


def test_participation_probability_is_full_when_behind_schedule_and_drops_when_ahead() -> None:
    assert calculate_pacing_participation_probability(10_000, 1_000, 0.5) == 1.0
    slightly_ahead = calculate_pacing_participation_probability(10_000, 5_300, 0.5)
    far_ahead = calculate_pacing_participation_probability(10_000, 5_600, 0.5)
    assert 0.0 < slightly_ahead < 1.0
    assert far_ahead < slightly_ahead
    assert calculate_pacing_participation_probability(10_000, 9_000, 0.5) == 0.0
    assert calculate_pacing_participation_probability(0, 0, 0.5) == 0.0


def test_day_progress_respects_the_campaign_timezone_offset() -> None:
    noon_utc = datetime(2026, 9, 28, 12, 0, tzinfo=UTC)
    assert calculate_day_progress_fraction(noon_utc, 0) == 0.5
    assert calculate_day_progress_fraction(noon_utc, 60) == 13 / 24


def test_cost_per_click_budget_guard_requires_remaining_daily_budget_of_at_least_one_bid() -> None:
    campaign = build_campaign("cpc", 200, 1_000)
    assert has_budget_for_one_more_charge(campaign, 800, 800)
    assert not has_budget_for_one_more_charge(campaign, 801, 801)


def test_total_budget_guard_blocks_campaign_even_when_daily_budget_remains() -> None:
    campaign = build_campaign("cpc", 200, 1_000_000, totalBudget={"amountMinor": 5_000, "currency": "USD"})
    assert has_budget_for_one_more_charge(campaign, 0, 4_800)
    assert not has_budget_for_one_more_charge(campaign, 0, 4_900)
    exhausted = build_campaign(
        "cpc",
        200,
        1_000_000,
        totalBudget={"amountMinor": 5_000, "currency": "USD"},
        spentTotal={"amountMinor": 4_900, "currency": "USD"},
    )
    assert evaluate_ad_eligibility(exhausted, build_context(DAY_START, "auction_total")) == "budget_exhausted"


def build_selection_request(reference_now: datetime, candidate: AdCandidate, **overrides: Any) -> AdSelectionRequest:
    return AdSelectionRequest.model_validate(
        {
            "placement": "feed",
            "viewer": build_viewer(),
            "organicItems": [{"itemId": f"post_{index}"} for index in range(12)],
            "candidates": [candidate.model_dump(mode="json", by_alias=True)],
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "now": reference_now.isoformat(),
            **overrides,
        }
    )


async def test_frequency_cap_from_request_counts_rejects_campaign(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    campaign = build_campaign("cpm", 1000, 1_000_000, frequencyCapPerDay=2, dayStartUtcOffsetMinutes=60)
    request = build_selection_request(reference_now, campaign, viewerImpressionsTodayByCampaign={"campaign_paced": 2})
    response = await application_container.ad_selection_service.select_ads(request)
    assert response.placements == []
    assert [(rejected.ad_id, rejected.reason) for rejected in response.rejected] == [("ad_paced", "frequency_capped")]


async def test_frequency_cap_from_ingested_ad_impression_events_rejects_campaign(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    impressions = [
        build_event(
            f"impression_{index}",
            "ad_impression",
            "viewer_1",
            reference_now,
            {
                "adId": "ad_paced",
                "campaignId": "campaign_paced",
                "advertiserId": "advertiser_paced",
                "auctionId": f"auction_{index}",
                "placement": "feed",
            },
        )
        for index in range(3)
    ]
    ingestion = await application_container.event_ingestion_service.ingest_event_batch(impressions)
    assert ingestion.accepted == 3
    campaign = build_campaign("cpm", 1000, 1_000_000, frequencyCapPerDay=3)
    response = await application_container.ad_selection_service.select_ads(
        build_selection_request(reference_now, campaign)
    )
    assert response.placements == []
    assert response.rejected[0].reason == "frequency_capped"


async def test_campaign_below_frequency_cap_still_wins_a_slot(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    campaign = build_campaign("cpm", 1000, 1_000_000, frequencyCapPerDay=3)
    request = build_selection_request(reference_now, campaign, viewerImpressionsTodayByCampaign={"campaign_paced": 1})
    response = await application_container.ad_selection_service.select_ads(request)
    assert [placement.ad_id for placement in response.placements] == ["ad_paced"]


async def test_online_click_spend_counts_when_higher_than_api_reported_spend(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    click = build_event(
        "click_1",
        "ad_click",
        "viewer_2",
        reference_now,
        {
            "adId": "ad_paced",
            "campaignId": "campaign_paced",
            "auctionId": "auction_1",
            "charge": {"amountMinor": 900, "currency": "USD"},
        },
    )
    await application_container.event_ingestion_service.ingest_event_batch([click])
    campaign = build_campaign("cpc", 200, 1_000)
    response = await application_container.ad_selection_service.select_ads(
        build_selection_request(reference_now, campaign)
    )
    assert response.placements == []
    assert response.rejected[0].reason == "budget_exhausted"
