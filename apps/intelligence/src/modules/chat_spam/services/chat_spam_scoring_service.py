from datetime import datetime

from src.dtos.common_dto import RankingResponseMetadata
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest, ChatSpamResponse, SenderBehaviourMetadata
from src.modules.domain_events.services.behaviour_feature_service import (
    AccountBehaviourSnapshot,
    read_account_behaviour_snapshot,
)
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.risk.services.risk_rules_service import combine_rule_weights_with_noisy_or
from src.modules.risk.services.risk_scoring_service import classify_risk_score
from src.modules.trust_advisory.services.suspension_suggestion_service import SuspensionSuggestionService
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time

SECONDS_PER_HOUR = 3600.0


def merge_stored_behaviour(
    supplied: SenderBehaviourMetadata, stored: AccountBehaviourSnapshot, now: datetime
) -> SenderBehaviourMetadata:
    stored_age_hours = (
        None
        if stored.account_created_at_unix is None
        else max((now.timestamp() - stored.account_created_at_unix) / SECONDS_PER_HOUR, 0.0)
    )
    stored_messages = int(stored.messages_sent)
    return supplied.model_copy(
        update={
            "account_age_hours": supplied.account_age_hours
            if supplied.account_age_hours is not None
            else stored_age_hours,
            "messages_last_day": max(supplied.messages_last_day, stored_messages),
            "distinct_recipients_last_day": max(supplied.distinct_recipients_last_day, stored.distinct_recipients),
            "links_sent_last_day": max(supplied.links_sent_last_day, int(stored.links_sent)),
            "reported_links_count": max(supplied.reported_links_count, int(stored.reported_links)),
        }
    )


def evaluate_chat_spam_rules(behaviour: SenderBehaviourMetadata) -> list[RiskReason]:
    reasons: list[RiskReason] = []

    def add(code: str, weight: float, triggered: bool) -> None:
        if triggered:
            reasons.append(RiskReason(code=code, weight=weight))

    is_new_account = behaviour.account_age_hours is not None and behaviour.account_age_hours < 24
    add("new_account_message_burst", 0.35, is_new_account and behaviour.messages_last_hour >= 10)
    add("new_recipient_fan_out_extreme", 0.7, behaviour.new_recipients_last_hour >= 50)
    add(
        "new_recipient_fan_out",
        0.45,
        20 <= behaviour.new_recipients_last_hour < 50,
    )
    add("recipient_report_rate_extreme", 0.6, behaviour.report_rate >= 0.15)
    add("recipient_report_rate_high", 0.4, 0.05 <= behaviour.report_rate < 0.15)
    add("recipient_block_rate_high", 0.35, behaviour.block_rate >= 0.1)
    add("reported_links_repeated", 0.6, behaviour.reported_links_count >= 3)
    add("reported_link_present", 0.3, 1 <= behaviour.reported_links_count < 3)
    add("link_heavy_sending", 0.25, behaviour.links_sent_last_day >= 15)
    add("shared_device_cluster", 0.3, behaviour.device_account_count >= 4)
    add("shared_ip_cluster", 0.15, behaviour.ip_account_count >= 10)
    add(
        "low_reply_rate_at_volume",
        0.25,
        behaviour.recipient_reply_rate is not None
        and behaviour.recipient_reply_rate < 0.05
        and behaviour.messages_last_day >= 30,
    )
    return reasons


class ChatSpamScoringService:
    def __init__(
        self, feature_store: OnlineFeatureStore | None, suggestion_service: SuspensionSuggestionService
    ) -> None:
        self.feature_store = feature_store
        self.suggestion_service = suggestion_service

    async def score_chat_spam(self, request: ChatSpamRequest) -> ChatSpamResponse:
        now = resolve_request_time(request.now)
        behaviour = request.behaviour
        degraded = False
        if request.use_stored_behaviour and self.feature_store is not None:
            try:
                stored = await read_account_behaviour_snapshot(
                    self.feature_store.feature_backend, self.feature_store.keyspace, request.sender_id, now
                )
                behaviour = merge_stored_behaviour(behaviour, stored, now)
            except FeatureBackendUnavailableError:
                degraded = True
        reasons = evaluate_chat_spam_rules(behaviour)
        score = combine_rule_weights_with_noisy_or(reasons)
        level, risk_action = classify_risk_score(score)
        action = {"allow": "allow", "review": "throttle", "hold_for_manual_review": "review"}[risk_action]
        suggested = await self.suggestion_service.suggest_if_warranted(
            request.sender_id, "intelligence.chat_spam", score, reasons, now
        )
        return ChatSpamResponse(
            sender_id=request.sender_id,
            score=round(score, 6),
            level=level,
            recommended_action=action,
            reasons=sorted(reasons, key=lambda reason: (-reason.weight, reason.code)),
            suspension_suggested=suggested,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="chat_spam:rules",
                degraded=degraded,
                generated_at=now,
            ),
        )
