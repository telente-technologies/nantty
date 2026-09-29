import random
from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest
from tests.conftest import SignedIntelligenceClient, build_event

NAIRA_RATE = [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}]
ALLOWED_ACTIONS = {"allow", "review", "hold_for_manual_review"}


def build_risk_request(subject_type: str, signals: dict[str, Any], actor_id: str = "sender_1") -> dict[str, Any]:
    signals_field = {
        "account_event": "accountEvent",
        "coin_purchase": "coinPurchase",
        "coin_transfer": "coinTransfer",
        "referral_reward": "referralReward",
    }.get(subject_type, subject_type)
    return {
        "subjectType": subject_type,
        "subjectId": f"{subject_type}_1",
        "actorId": actor_id,
        "exchangeRates": NAIRA_RATE,
        signals_field: signals,
    }


def naira(amount_minor: int) -> dict[str, Any]:
    return {"amountMinor": amount_minor, "currency": "NGN"}


def reason_codes(response_json: dict[str, Any]) -> set[str]:
    return {reason["code"] for reason in response_json["reasons"]}


async def score(client: SignedIntelligenceClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = await client.post("/v1/risk/score", payload)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    assert body["recommendedAction"] in ALLOWED_ACTIONS
    return body


async def test_suspicious_order_in_naira_is_held_for_manual_review(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        build_risk_request(
            "order",
            {
                "amount": naira(50_000_000),
                "accountAgeHours": 3,
                "buyerPreviousOrderCount": 0,
                "ordersLastHour": 6,
                "buyerAndSellerShareDevice": True,
            },
        ),
    )
    assert {"new_account_high_value", "order_velocity", "buyer_and_seller_share_device"} <= reason_codes(body)
    assert body["level"] == "high"
    assert body["recommendedAction"] == "hold_for_manual_review"


async def test_clean_order_is_low_risk_and_allowed(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        build_risk_request("order", {"amount": naira(500_000), "accountAgeHours": 4000, "buyerPreviousOrderCount": 12}),
    )
    assert (body["level"], body["recommendedAction"], body["score"]) == ("low", "allow", 0.0)


async def test_missing_exchange_rate_adds_zero_weight_reason(signed_client: SignedIntelligenceClient) -> None:
    payload = build_risk_request(
        "order",
        {"amount": {"amountMinor": 100, "currency": "GHS"}, "accountAgeHours": 1, "buyerPreviousOrderCount": 0},
    )
    body = await score(signed_client, payload)
    weights = {reason["code"]: reason["weight"] for reason in body["reasons"]}
    assert weights["exchange_rate_unavailable"] == 0.0
    assert "new_account_high_value" not in weights


async def test_random_orders_never_produce_an_action_outside_allow_review_or_hold(
    application_container: ApplicationContainer,
) -> None:
    generator = random.Random(11)
    for index in range(60):
        request = RiskScoringRequest.model_validate(
            {
                **build_risk_request(
                    "order",
                    {
                        "amount": naira(generator.randint(1, 10**9)),
                        "accountAgeHours": generator.uniform(0, 5000),
                        "buyerPreviousOrderCount": generator.randint(0, 50),
                        "ordersLastHour": generator.randint(0, 20),
                        "failedPaymentAttemptsLastDay": generator.randint(0, 10),
                        "deviceAccountCount": generator.randint(0, 10),
                        "isNewPaymentInstrument": generator.random() < 0.5,
                        "buyerAndSellerShareDevice": generator.random() < 0.3,
                        "sellerDisputeRate": generator.random(),
                    },
                ),
                "subjectId": f"order_{index}",
            }
        )
        response = await application_container.risk_scoring_service.score_risk(request)
        assert response.recommended_action in ALLOWED_ACTIONS
        assert 0.0 <= response.score <= 1.0


async def test_payout_to_recently_changed_destination_exceeding_earnings_is_flagged(
    signed_client: SignedIntelligenceClient,
) -> None:
    body = await score(
        signed_client,
        build_risk_request(
            "payout",
            {
                "amount": naira(900_000),
                "lifetimeEarnings": naira(500_000),
                "sellerAccountAgeHours": 5000,
                "hoursSincePayoutDestinationChanged": 5,
                "isIdentityVerified": True,
            },
        ),
    )
    assert {"payout_destination_changed_last_day", "payout_exceeds_lifetime_earnings"} <= reason_codes(body)
    assert body["level"] == "high"


async def test_account_events_detect_otp_bruteforce_and_signup_farms(signed_client: SignedIntelligenceClient) -> None:
    bruteforce = await score(
        signed_client, build_risk_request("account_event", {"eventKind": "login", "failedOtpAttemptsLastHour": 9})
    )
    farm = await score(
        signed_client, build_risk_request("account_event", {"eventKind": "signup", "signupsOnDeviceLastDay": 4})
    )
    assert "otp_bruteforce" in reason_codes(bruteforce)
    assert "signup_farm" in reason_codes(farm)


async def test_large_coin_purchase_on_new_account_is_flagged(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        build_risk_request(
            "coin_purchase",
            {"amount": naira(20_000_000), "coinAmount": 50_000, "accountAgeHours": 2, "purchasesLastDay": 6},
        ),
    )
    assert {"new_account_large_coin_purchase", "coin_purchase_velocity"} <= reason_codes(body)


async def test_coin_transfer_back_to_previous_sender_is_detected_as_reciprocal_ring(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    earlier_transfer = build_event(
        "transfer_1",
        "coin_transferred",
        "recipient_1",
        reference_now,
        {"transferId": "transfer_1", "recipientId": "sender_1", "coinAmount": 5_000},
    )
    ingestion = await signed_client.post("/v1/events", {"events": [earlier_transfer]})
    assert ingestion.json()["accepted"] == 1
    body = await score(
        signed_client,
        build_risk_request(
            "coin_transfer",
            {
                "recipientId": "recipient_1",
                "coinAmount": 5_000,
                "senderAccountAgeHours": 500,
                "recipientAccountAgeHours": 500,
                "minutesSinceSenderReceivedTheseCoins": 5,
            },
        ),
    )
    assert {"reciprocal_transfer_ring", "rapid_forwarding_of_received_coins"} <= reason_codes(body)
    assert body["metadata"]["degraded"] is False


async def test_coin_transfer_without_history_has_no_ring_reason(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        build_risk_request(
            "coin_transfer",
            {
                "recipientId": "recipient_fresh",
                "coinAmount": 10,
                "senderAccountAgeHours": 500,
                "recipientAccountAgeHours": 500,
            },
        ),
    )
    assert body["reasons"] == []


async def test_gift_to_creator_who_sent_coins_to_the_sender_is_laundering(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    creator_to_sender = build_event(
        "gift_back_1",
        "gift_sent",
        "creator_1",
        reference_now,
        {"giftId": "gift_back_1", "creatorId": "sender_1", "coinAmount": 900},
    )
    await signed_client.post("/v1/events", {"events": [creator_to_sender]})
    body = await score(
        signed_client,
        build_risk_request(
            "gift",
            {
                "creatorId": "creator_1",
                "coinAmount": 900,
                "senderAccountAgeHours": 900,
                "creatorAccountAgeHours": 900,
                "senderAndCreatorShareDevice": True,
            },
        ),
    )
    assert {"gift_reciprocity_laundering", "sender_and_creator_share_device"} <= reason_codes(body)
    assert body["level"] == "high"


async def test_self_referral_ring_and_cashback_self_purchase_are_flagged(
    signed_client: SignedIntelligenceClient,
) -> None:
    referral = await score(
        signed_client,
        build_risk_request(
            "referral_reward",
            {
                "refereeId": "referee_1",
                "referrerAccountAgeHours": 800,
                "refereeAccountAgeHours": 1,
                "sharePaymentInstrument": True,
                "linkedAccountClusterSize": 4,
            },
        ),
    )
    cashback = await score(
        signed_client,
        build_risk_request(
            "cashback", {"amount": naira(100_000), "buyerLinkedToSellerAccount": True, "accountAgeHours": 800}
        ),
    )
    assert {"self_referral_ring", "referrer_and_referee_share_payment_instrument"} <= reason_codes(referral)
    assert "buyer_linked_to_seller" in reason_codes(cashback)


async def test_signals_block_must_match_subject_type_exactly(signed_client: SignedIntelligenceClient) -> None:
    mismatched = build_risk_request("payout", {"eventKind": "login"})
    mismatched["accountEvent"] = mismatched.pop("payout")
    two_blocks = build_risk_request("account_event", {"eventKind": "login"})
    two_blocks["cashback"] = {"amount": naira(1), "accountAgeHours": 1}
    for payload in (mismatched, two_blocks):
        response = await signed_client.post("/v1/risk/score", payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_request"
