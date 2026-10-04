from typing import Any

from tests.conftest import SignedIntelligenceClient


def signals(**overrides: Any) -> dict[str, Any]:
    return {
        "profileId": "profile_1",
        "color": "blue",
        "accountAgeDays": 400,
        "realFollowers": 5000,
        "originalPostsLast60Days": 20,
        "daysSinceLastViolation": 100000,
        "fraudScore": 0,
        "riskScore": 0,
        "phoneVerified": True,
        "emailVerified": True,
        **overrides,
    }


async def assess(client: SignedIntelligenceClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = await client.post("/v1/verification/eligibility", payload)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_established_clean_account_can_buy_now(signed_client: SignedIntelligenceClient) -> None:
    body = await assess(signed_client, signals())
    assert body["tier"] == "buy_now"
    assert body["trustScore"] >= 75
    assert body["recheckAfterHours"] == 0


async def test_new_account_is_asked_to_request_and_rechecked_later(signed_client: SignedIntelligenceClient) -> None:
    body = await assess(signed_client, signals(accountAgeDays=5, realFollowers=40, originalPostsLast60Days=1))
    assert body["tier"] == "request"
    assert "account_age_below_threshold" in body["reasons"]
    assert "real_followers_below_threshold" in body["reasons"]
    assert body["recheckAfterHours"] > 0


async def test_recent_strike_blocks_buy_now_even_with_a_high_score(signed_client: SignedIntelligenceClient) -> None:
    body = await assess(signed_client, signals(daysSinceLastViolation=10))
    assert body["tier"] == "request"
    assert "recent_violation" in body["reasons"]


async def test_bot_and_fraud_signals_block(signed_client: SignedIntelligenceClient) -> None:
    body = await assess(signed_client, signals(fraudScore=90))
    assert body["tier"] == "blocked"
    assert body["reasons"][0] == "fraud_or_bot_signals"
    restricted = await assess(signed_client, signals(accountRestricted=True))
    assert restricted["tier"] == "blocked"
    assert restricted["reasons"][0] == "account_restricted"


async def test_gold_uses_store_track_record(signed_client: SignedIntelligenceClient) -> None:
    store = {
        "color": "gold",
        "realFollowers": 0,
        "completedOrders": 120,
        "successRatePercent": 97,
        "hasActiveStoreOrBrandPage": True,
    }
    assert (await assess(signed_client, signals(**store)))["tier"] == "buy_now"
    weak = await assess(signed_client, signals(**{**store, "completedOrders": 2, "hasActiveStoreOrBrandPage": False}))
    assert weak["tier"] == "request"
    assert "completed_orders_below_threshold" in weak["reasons"]


async def test_unsigned_requests_are_rejected(signed_client: SignedIntelligenceClient) -> None:
    response = await signed_client.http_client.post("/v1/verification/eligibility", json=signals())
    assert response.status_code == 401
