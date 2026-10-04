import contextlib
import hashlib
import logging
from datetime import datetime

from src.dtos.common_dto import RankingResponseMetadata
from src.interfaces.feature_backend_interface import FeatureBackend
from src.modules.bot_detection.dtos.bot_detection_dto import (
    BotBehaviourMetadata,
    BotScoreAdvisory,
    BotScoreRequest,
    BotScoreResponse,
)
from src.modules.bot_detection.repositories.bot_score_queue_repository import BotScorePublisher
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.risk.services.risk_rules_service import combine_rule_weights_with_noisy_or
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace, format_utc_day_bucket
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time

bot_logger = logging.getLogger("intelligence.bot_detection")
BOT_RULES_VERSION = "bot_rules:v1"
PUBLISH_THRESHOLD = 0.6
PUBLISH_DEDUPLICATION_TTL_SECONDS = 6 * 3600


def evaluate_bot_rules(behaviour: BotBehaviourMetadata) -> list[RiskReason]:
    reasons: list[RiskReason] = []

    def add(code: str, weight: float, triggered: bool) -> None:
        if triggered:
            reasons.append(RiskReason(code=code, weight=weight))

    cadence = behaviour.cadence
    is_new_account = behaviour.account_age_hours is not None and behaviour.account_age_hours < 72
    add(
        "robotic_request_cadence",
        0.5,
        cadence.interval_coefficient_of_variation is not None
        and cadence.interval_coefficient_of_variation < 0.08
        and cadence.requests_last_minute >= 20,
    )
    add("superhuman_request_rate", 0.45, cadence.requests_last_minute >= 240)
    add("always_on_activity", 0.3, cadence.active_hours_last_day >= 22)
    add("headless_client", 0.55, len(behaviour.headless_signals) > 0)
    add("device_integrity_failed", 0.6, behaviour.attestation_verdict == "failed")
    add("follow_burst", 0.45, behaviour.follows_last_hour >= 60)
    add("like_burst", 0.4, behaviour.likes_last_hour >= 300)
    add("comment_burst", 0.35, behaviour.comments_last_hour >= 60)
    add("duplicate_comments", 0.4, behaviour.duplicate_comment_share >= 0.6 and behaviour.comments_last_hour >= 10)
    add("engagement_manipulation", 0.45, behaviour.engagement_manipulation_share >= 0.5)
    add(
        "new_account_velocity",
        0.3,
        is_new_account and (behaviour.follows_last_hour >= 30 or behaviour.likes_last_hour >= 150),
    )
    add("shared_device_cluster", 0.3, behaviour.device_account_count >= 4)
    add("shared_ip_cluster", 0.15, behaviour.ip_account_count >= 20)
    return reasons


def classify_bot_score(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= PUBLISH_THRESHOLD:
        return "medium"
    return "low"


class BotScoringService:
    def __init__(
        self, publisher: BotScorePublisher, backend: FeatureBackend | None, keyspace: OnlineFeatureKeyspace | None
    ) -> None:
        self.publisher = publisher
        self.backend = backend
        self.keyspace = keyspace

    async def score_bot_likelihood(self, request: BotScoreRequest) -> BotScoreResponse:
        now = resolve_request_time(request.now)
        reasons = sorted(evaluate_bot_rules(request.behaviour), key=lambda reason: (-reason.weight, reason.code))
        score = round(combine_rule_weights_with_noisy_or(reasons), 6)
        published = False
        if score >= PUBLISH_THRESHOLD:
            published = await self.publish_once_per_window(request.account_id, score, reasons, now)
        return BotScoreResponse(
            account_id=request.account_id,
            score=score,
            level=classify_bot_score(score),
            reasons=reasons,
            published_to_trust=published,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="bot_detection:rules",
                model_version=BOT_RULES_VERSION,
                generated_at=now,
            ),
        )

    async def publish_once_per_window(
        self, account_id: str, score: float, reasons: list[RiskReason], now: datetime
    ) -> bool:
        bucket = f"{format_utc_day_bucket(now)}:{now.hour // 6}"
        score_id = hashlib.sha256(f"{account_id}|bot|{bucket}".encode()).hexdigest()[:32]
        claim_key = None
        try:
            if self.backend is not None and self.keyspace is not None:
                claim_key = self.keyspace.event_deduplication_key(f"bot-score:{score_id}")
                claimed = await self.backend.claim_keys_if_absent([claim_key], PUBLISH_DEDUPLICATION_TTL_SECONDS)
                if not claimed[0]:
                    return False
            await self.publisher.publish_bot_score(
                BotScoreAdvisory(
                    score_id=score_id,
                    account_id=account_id,
                    score=score,
                    reason_codes=[reason.code for reason in reasons[:10]],
                    model_version=BOT_RULES_VERSION,
                    generated_at=now,
                )
            )
        except Exception:
            bot_logger.exception("bot_score_publish_failed")
            if claim_key is not None and self.backend is not None:
                with contextlib.suppress(Exception):
                    await self.backend.delete_keys([claim_key])
            return False
        return True
