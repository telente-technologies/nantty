from typing import Any

import pytest

from tests.conftest import SignedIntelligenceClient

NAIRA_RATE = [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}]


def request_for(subject_type: str, field: str, signals: dict[str, Any]) -> dict[str, Any]:
    return {
        "subjectType": subject_type,
        "subjectId": f"{subject_type}_1",
        "actorId": "actor_1",
        "exchangeRates": NAIRA_RATE,
        field: signals,
    }


async def score(client: SignedIntelligenceClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = await client.post("/v1/risk/score-extended", payload)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    assert body["recommendedAction"] in {"allow", "review", "hold_for_manual_review"}
    return body


def codes(body: dict[str, Any]) -> set[str]:
    return {reason["code"] for reason in body["reasons"]}


CLEAN_AND_RISKY_CASES: list[tuple[str, str, dict[str, Any], dict[str, Any], set[str]]] = [
    (
        "account",
        "account",
        {"accountAgeHours": 5000},
        {
            "accountAgeHours": 1,
            "signupsOnDeviceLastDay": 6,
            "sharesInstrumentWithBannedAccount": True,
            "priorSuspensions": 2,
        },
        {"signup_farm_device", "shares_instrument_with_banned_account"},
    ),
    (
        "payment",
        "payment",
        {"amount": {"amountMinor": 500_000, "currency": "NGN"}, "accountAgeHours": 4000},
        {
            "amount": {"amountMinor": 90_000_000, "currency": "NGN"},
            "accountAgeHours": 3,
            "failedAttemptsLastHour": 6,
            "distinctCardsLastDay": 4,
            "chargebacksLast90Days": 1,
        },
        {"new_account_high_value", "card_testing_failures", "prior_chargebacks"},
    ),
    (
        "ad_click",
        "adClick",
        {"clicksByActorLastHour": 1},
        {
            "clicksByActorLastHour": 40,
            "isDatacenterIp": True,
            "clickerAndAdvertiserShareDevice": True,
            "millisecondsFromImpressionToClick": 80,
        },
        {"click_velocity_actor", "datacenter_ip", "clicker_shares_device_with_advertiser"},
    ),
    (
        "refund",
        "refund",
        {
            "amount": {"amountMinor": 500_000, "currency": "NGN"},
            "orderAmount": {"amountMinor": 500_000, "currency": "NGN"},
            "buyerAccountAgeHours": 3000,
        },
        {
            "amount": {"amountMinor": 40_000_000, "currency": "NGN"},
            "orderAmount": {"amountMinor": 40_000_000, "currency": "NGN"},
            "buyerAccountAgeHours": 10,
            "buyerRefundRateLast90Days": 0.6,
            "buyerAndSellerShareDevice": True,
        },
        {"high_refund_rate_buyer", "new_buyer_high_refund", "buyer_and_seller_share_device"},
    ),
    (
        "marketplace",
        "marketplace",
        {"sellerAccountAgeHours": 4000, "listingsCreatedLastDay": 3},
        {
            "sellerAccountAgeHours": 10,
            "listingsCreatedLastDay": 80,
            "priceToCategoryMedianRatio": 0.05,
            "prohibitedCategoryHit": True,
            "duplicateListingCount": 9,
        },
        {"new_seller_listing_burst", "price_far_below_category", "prohibited_category_hit"},
    ),
]


@pytest.mark.parametrize(("subject_type", "field", "clean", "risky", "expected_codes"), CLEAN_AND_RISKY_CASES)
async def test_each_subject_scores_clean_low_and_risky_high(
    signed_client: SignedIntelligenceClient,
    subject_type: str,
    field: str,
    clean: dict[str, Any],
    risky: dict[str, Any],
    expected_codes: set[str],
) -> None:
    clean_body = await score(signed_client, request_for(subject_type, field, clean))
    assert clean_body["level"] == "low"
    assert clean_body["recommendedAction"] == "allow"
    risky_body = await score(signed_client, request_for(subject_type, field, risky))
    assert expected_codes <= codes(risky_body)
    assert risky_body["level"] == "high"
    assert risky_body["recommendedAction"] == "hold_for_manual_review"
    assert risky_body["metadata"]["rankingSource"] == "extended_risk:rules"


async def test_signals_block_must_match_subject_type(signed_client: SignedIntelligenceClient) -> None:
    mismatched = request_for("payment", "account", {"accountAgeHours": 5})
    assert (await signed_client.post("/v1/risk/score-extended", mismatched)).status_code == 422
    unknown = request_for("account", "account", {"accountAgeHours": 5, "note": "free text"})
    assert (await signed_client.post("/v1/risk/score-extended", unknown)).status_code == 422
