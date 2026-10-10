import inspect
from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest, SenderBehaviourMetadata
from src.modules.chat_spam.services import chat_spam_scoring_service
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.trust_advisory.dtos.suspension_suggestion_dto import SuspensionSuggestion
from src.modules.trust_advisory.services.suspension_suggestion_service import SuspensionSuggestionService
from tests.conftest import SignedIntelligenceClient
from tests.modules.domain_events.test_domain_event_consumer import domain_event

CONTENT_FIELD_NAMES = {"text", "body", "content", "message", "messagetext", "caption", "attachment"}


async def score(client: SignedIntelligenceClient, behaviour: dict[str, Any], **extra: Any) -> dict[str, Any]:
    response = await client.post(
        "/v1/chat/spam-score", {"senderId": "sender_1", "behaviour": behaviour, "useStoredBehaviour": False, **extra}
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_quiet_sender_is_allowed(signed_client: SignedIntelligenceClient) -> None:
    body = await score(signed_client, {"accountAgeHours": 900, "messagesLastHour": 3, "newRecipientsLastHour": 1})
    assert body["recommendedAction"] == "allow"
    assert body["level"] == "low"
    assert body["reasons"] == []
    assert body["metadata"]["rankingSource"] == "chat_spam:rules"


async def test_fan_out_to_new_recipients_with_reports_is_flagged(signed_client: SignedIntelligenceClient) -> None:
    body = await score(
        signed_client,
        {
            "accountAgeHours": 2,
            "messagesLastHour": 90,
            "newRecipientsLastHour": 80,
            "reportRate": 0.2,
            "reportedLinksCount": 3,
        },
    )
    codes = {reason["code"] for reason in body["reasons"]}
    assert {"new_recipient_fan_out_extreme", "recipient_report_rate_extreme", "reported_links_repeated"} <= codes
    assert body["level"] == "high"
    assert body["recommendedAction"] == "review"


async def test_message_content_fields_are_rejected_by_the_contract(signed_client: SignedIntelligenceClient) -> None:
    for field_name in ("text", "body", "messageText"):
        response = await signed_client.post(
            "/v1/chat/spam-score", {"senderId": "sender_1", "behaviour": {}, field_name: "free money click here"}
        )
        assert response.status_code == 422
        nested = await signed_client.post(
            "/v1/chat/spam-score", {"senderId": "sender_1", "behaviour": {field_name: "hello"}}
        )
        assert nested.status_code == 422


def test_spam_contract_has_no_content_bearing_field_and_scorer_takes_only_metadata() -> None:
    request_fields = set(ChatSpamRequest.model_fields) | set(SenderBehaviourMetadata.model_fields)
    assert not {name.replace("_", "") for name in request_fields} & CONTENT_FIELD_NAMES
    source = inspect.getsource(chat_spam_scoring_service)
    assert "text" not in {name.lower() for name in dir(SenderBehaviourMetadata) if not name.startswith("_")}
    assert ".text" not in source
    assert ".body" not in source


async def test_stored_behaviour_from_events_raises_the_score(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    for index in range(40):
        await consumer.process_message_body(
            domain_event(
                f"evt_m{index}",
                "message.sent",
                "sender_s",
                reference_now,
                {
                    "recipientId": f"r{index}",
                    "conversationId": f"c{index}",
                    "containsLink": True,
                    "linkReported": index < 4,
                    "deviceId": "dev",
                },
            )
        )
    response = await application_container.chat_spam_scoring_service.score_chat_spam(
        ChatSpamRequest(sender_id="sender_s", now=reference_now)
    )
    codes = {reason.code for reason in response.reasons}
    assert "reported_links_repeated" in codes
    assert "link_heavy_sending" in codes


class RecordingPublisher:
    delivers = True

    def __init__(self) -> None:
        self.published: list[SuspensionSuggestion] = []

    async def publish_suspension_suggestion(self, suggestion: SuspensionSuggestion) -> None:
        self.published.append(suggestion)


async def test_high_score_publishes_one_advisory_suggestion_with_evidence_never_an_action(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    publisher = RecordingPublisher()
    suggestion_service = SuspensionSuggestionService(
        publisher, application_container.feature_backend, application_container.feature_store.keyspace
    )
    service = chat_spam_scoring_service.ChatSpamScoringService(None, suggestion_service)
    request = ChatSpamRequest(
        sender_id="sender_x",
        behaviour=SenderBehaviourMetadata(
            account_age_hours=1, new_recipients_last_hour=90, report_rate=0.3, reported_links_count=5, block_rate=0.2
        ),
        now=reference_now,
    )
    first = await service.score_chat_spam(request)
    second = await service.score_chat_spam(request)
    assert first.suspension_suggested
    assert not second.suspension_suggested
    assert len(publisher.published) == 1
    suggestion = publisher.published[0]
    assert suggestion.advisory_only is True
    assert suggestion.subject_id == "sender_x"
    assert {item.code for item in suggestion.evidence} >= {"new_recipient_fan_out_extreme"}
    assert not hasattr(suggestion, "action")


async def test_publisher_failure_never_breaks_scoring(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    class FailingPublisher:
        delivers = True

        async def publish_suspension_suggestion(self, _suggestion: SuspensionSuggestion) -> None:
            raise RuntimeError("queue down")

    service = SuspensionSuggestionService(
        FailingPublisher(), application_container.feature_backend, application_container.feature_store.keyspace
    )
    reasons = [RiskReason(code="x", weight=0.9)]
    assert await service.suggest_if_warranted("acct", "test", 0.95, reasons, reference_now) is False
    assert await service.suggest_if_warranted("acct", "test", 0.5, reasons, reference_now) is False
