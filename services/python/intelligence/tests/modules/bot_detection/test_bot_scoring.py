from datetime import UTC, datetime
from typing import Any

from src.modules.bot_detection.dtos.bot_detection_dto import BotBehaviourMetadata, BotScoreAdvisory, BotScoreRequest
from src.modules.bot_detection.services.bot_scoring_service import BotScoringService, evaluate_bot_rules
from tests.conftest import SignedIntelligenceClient

NOW = datetime(2026, 10, 4, 12, 0, tzinfo=UTC)


class RecordingBotScorePublisher:
    delivers = True

    def __init__(self) -> None:
        self.published: list[BotScoreAdvisory] = []

    async def publish_bot_score(self, advisory: BotScoreAdvisory) -> None:
        self.published.append(advisory)


async def score(client: SignedIntelligenceClient, behaviour: dict[str, Any]) -> dict[str, Any]:
    response = await client.post("/v1/trust/bot-score", {"accountId": "acct_1", "behaviour": behaviour})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_a_human_paced_account_scores_low(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        {
            "accountAgeHours": 4000,
            "cadence": {"requestsLastMinute": 6, "intervalCoefficientOfVariation": 0.9},
            "likesLastHour": 12,
        },
    )
    assert body["level"] == "low"
    assert body["reasons"] == []
    assert body["advisoryOnly"] is True
    assert body["metadata"]["rankingSource"] == "bot_detection:rules"


async def test_robotic_cadence_with_headless_signals_and_follow_bursts_scores_high(
    signed_client: SignedIntelligenceClient,
) -> None:
    body = await score(
        signed_client,
        {
            "accountAgeHours": 3,
            "cadence": {"requestsLastMinute": 90, "intervalCoefficientOfVariation": 0.02, "activeHoursLastDay": 23},
            "headlessSignals": ["webdriver"],
            "followsLastHour": 200,
        },
    )
    codes = {reason["code"] for reason in body["reasons"]}
    assert body["level"] == "high"
    assert {"robotic_request_cadence", "headless_client", "follow_burst", "new_account_velocity"} <= codes


def test_failed_device_attestation_and_manipulation_are_signals() -> None:
    reasons = evaluate_bot_rules(BotBehaviourMetadata(attestation_verdict="failed", engagement_manipulation_share=0.7))
    assert {reason.code for reason in reasons} == {"device_integrity_failed", "engagement_manipulation"}


async def test_high_scores_are_published_to_trust_once_per_window_and_stay_advisory() -> None:
    publisher = RecordingBotScorePublisher()
    service = BotScoringService(publisher, None, None)
    behaviour = BotBehaviourMetadata(
        headless_signals=["automation_globals"], follows_last_hour=120, likes_last_hour=500
    )
    first = await service.score_bot_likelihood(BotScoreRequest(account_id="acct_9", behaviour=behaviour, now=NOW))
    quiet = await service.score_bot_likelihood(
        BotScoreRequest(account_id="acct_10", behaviour=BotBehaviourMetadata(), now=NOW)
    )
    assert first.published_to_trust is True
    assert quiet.published_to_trust is False
    assert len(publisher.published) == 1
    advisory = publisher.published[0]
    assert advisory.advisory_only is True
    assert advisory.account_id == "acct_9"
    assert "headless_client" in advisory.reason_codes
    assert advisory.model_dump(by_alias=True)["advisoryOnly"] is True
