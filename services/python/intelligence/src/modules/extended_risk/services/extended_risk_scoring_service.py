from src.dtos.common_dto import RankingResponseMetadata
from src.modules.extended_risk.dtos.extended_risk_dto import (
    SUSPENSION_ELIGIBLE_SUBJECT_TYPES,
    ExtendedRiskRequest,
    ExtendedRiskResponse,
)
from src.modules.extended_risk.services.extended_risk_rules_service import evaluate_extended_risk_rules
from src.modules.risk.services.risk_rules_service import combine_rule_weights_with_noisy_or
from src.modules.risk.services.risk_scoring_service import classify_risk_score
from src.modules.trust_advisory.services.suspension_suggestion_service import SuspensionSuggestionService
from src.services.currency_conversion_service import build_usd_rate_lookup
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time


class ExtendedRiskScoringService:
    def __init__(self, suggestion_service: SuspensionSuggestionService) -> None:
        self.suggestion_service = suggestion_service

    async def score_extended_risk_subject(self, request: ExtendedRiskRequest) -> ExtendedRiskResponse:
        now = resolve_request_time(request.now)
        reasons = evaluate_extended_risk_rules(request, build_usd_rate_lookup(request.exchange_rates))
        score = combine_rule_weights_with_noisy_or(reasons)
        level, action = classify_risk_score(score)
        suggested = False
        if request.subject_type in SUSPENSION_ELIGIBLE_SUBJECT_TYPES:
            suggested = await self.suggestion_service.suggest_if_warranted(
                request.actor_id, f"intelligence.risk.{request.subject_type}", score, reasons, now
            )
        return ExtendedRiskResponse(
            subject_type=request.subject_type,
            subject_id=request.subject_id,
            score=round(score, 6),
            level=level,
            recommended_action=action,
            reasons=sorted(reasons, key=lambda reason: (-reason.weight, reason.code)),
            suspension_suggested=suggested,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="extended_risk:rules",
                generated_at=now,
            ),
        )
