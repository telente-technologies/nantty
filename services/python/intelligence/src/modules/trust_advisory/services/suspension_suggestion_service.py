import asyncio
import contextlib
import hashlib
import logging
from collections.abc import Sequence
from datetime import datetime

from src.interfaces.feature_backend_interface import FeatureBackend
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.trust_advisory.dtos.suspension_suggestion_dto import SuspensionEvidence, SuspensionSuggestion
from src.modules.trust_advisory.repositories.trust_advisory_queue_repository import TrustAdvisoryPublisher
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace, format_utc_day_bucket

advisory_logger = logging.getLogger("intelligence.trust_advisory")
SUSPENSION_SUGGESTION_THRESHOLD = 0.8
SUGGESTION_DEDUPLICATION_TTL_SECONDS = 24 * 3600
MAXIMUM_EVIDENCE_ITEMS = 8


class SuspensionSuggestionService:
    def __init__(
        self, publisher: TrustAdvisoryPublisher, backend: FeatureBackend, keyspace: OnlineFeatureKeyspace
    ) -> None:
        self.publisher = publisher
        self.backend = backend
        self.keyspace = keyspace

    async def suggest_if_warranted(
        self, account_id: str, source: str, score: float, reasons: Sequence[RiskReason], now: datetime
    ) -> bool:
        if score < SUSPENSION_SUGGESTION_THRESHOLD:
            return False
        suggestion_id = hashlib.sha256(f"{account_id}|{source}|{format_utc_day_bucket(now)}".encode()).hexdigest()[:32]
        claim_key = self.keyspace.internal_claim_key("suggestion", suggestion_id)
        try:
            claimed = await self.backend.claim_keys_if_absent([claim_key], SUGGESTION_DEDUPLICATION_TTL_SECONDS)
            if not claimed[0]:
                return False
            ordered = sorted(reasons, key=lambda reason: (-reason.weight, reason.code))[:MAXIMUM_EVIDENCE_ITEMS]
            await self.publisher.publish_suspension_suggestion(
                SuspensionSuggestion(
                    suggestion_id=suggestion_id,
                    subject_id=account_id,
                    source=source,
                    score=round(score, 6),
                    evidence=[SuspensionEvidence(code=reason.code, weight=reason.weight) for reason in ordered],
                    generated_at=now,
                )
            )
        except asyncio.CancelledError:
            with contextlib.suppress(Exception):
                await self.backend.delete_keys([claim_key])
            raise
        except Exception:
            advisory_logger.exception("suspension_suggestion_publish_failed")
            with contextlib.suppress(Exception):
                await self.backend.delete_keys([claim_key])
            return False
        if not self.publisher.delivers:
            with contextlib.suppress(Exception):
                await self.backend.delete_keys([claim_key])
        return self.publisher.delivers
