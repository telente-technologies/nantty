from decimal import Decimal
from typing import Literal

import numpy as np

from src.dtos.common_dto import RankingResponseMetadata
from src.enums.ranking_surface_enum import RankingSurface
from src.modules.model_registry.models.model_bundle_model import MultiHeadClassifierBundle
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.risk.dtos.risk_scoring_dto import RiskReason, RiskScoringRequest, RiskScoringResponse
from src.modules.risk.services.risk_rules_service import (
    ORDER_RISK_FEATURE_NAMES,
    ORDER_RISK_FEATURE_SCHEMA_VERSION,
    build_order_risk_feature_values,
    combine_rule_weights_with_noisy_or,
    evaluate_account_event_risk_rules,
    evaluate_order_risk_rules,
    evaluate_payout_risk_rules,
)
from src.modules.risk.services.value_flow_feature_service import ValueFlowSignals, read_value_flow_signals
from src.modules.risk.services.value_transfer_risk_rules_service import (
    evaluate_cashback_risk_rules,
    evaluate_coin_purchase_risk_rules,
    evaluate_coin_transfer_risk_rules,
    evaluate_gift_risk_rules,
    evaluate_referral_reward_risk_rules,
)
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.currency_conversion_service import build_usd_rate_lookup
from src.services.ranking_context_service import (
    log_served_feature_rows,
    resolve_request_identifier,
    resolve_request_time,
)

MEDIUM_RISK_THRESHOLD = 0.3
HIGH_RISK_THRESHOLD = 0.7
MODEL_BLEND_WEIGHT = 0.5


def find_value_flow_counterparty(request: RiskScoringRequest) -> str | None:
    if request.coin_transfer is not None:
        return request.coin_transfer.recipient_id
    if request.gift is not None:
        return request.gift.creator_id
    return None


def evaluate_rules_for_subject(
    request: RiskScoringRequest, flow: ValueFlowSignals, rates: dict[str, Decimal]
) -> list[RiskReason]:
    if request.order is not None:
        return evaluate_order_risk_rules(request.order, rates)
    if request.payout is not None:
        return evaluate_payout_risk_rules(request.payout)
    if request.account_event is not None:
        return evaluate_account_event_risk_rules(request.account_event)
    if request.coin_purchase is not None:
        return evaluate_coin_purchase_risk_rules(request.coin_purchase, rates)
    if request.coin_transfer is not None:
        return evaluate_coin_transfer_risk_rules(request.coin_transfer, flow)
    if request.gift is not None:
        return evaluate_gift_risk_rules(request.gift, flow)
    if request.referral_reward is not None:
        return evaluate_referral_reward_risk_rules(request.referral_reward, flow)
    if request.cashback is not None:
        return evaluate_cashback_risk_rules(request.cashback, rates)
    return []


def classify_risk_score(
    final_score: float,
) -> tuple[Literal["low", "medium", "high"], Literal["allow", "review", "hold_for_manual_review"]]:
    if final_score >= HIGH_RISK_THRESHOLD:
        return "high", "hold_for_manual_review"
    if final_score >= MEDIUM_RISK_THRESHOLD:
        return "medium", "review"
    return "low", "allow"


class RiskScoringService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        feature_log_sink: FeatureLogParquetSink | None,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.feature_log_sink = feature_log_sink

    async def score_risk(self, request: RiskScoringRequest) -> RiskScoringResponse:
        now = resolve_request_time(request.now)
        request_id = resolve_request_identifier(request.request_id)
        usd_rate_lookup = build_usd_rate_lookup(request.exchange_rates)
        needs_flow = request.subject_type in {"coin_transfer", "gift", "referral_reward"}
        flow = (
            await read_value_flow_signals(
                self.feature_store, request.actor_id, find_value_flow_counterparty(request), now
            )
            if needs_flow
            else ValueFlowSignals()
        )
        reasons = evaluate_rules_for_subject(request, flow, usd_rate_lookup)
        rule_score = combine_rule_weights_with_noisy_or(reasons)
        model_score: float | None = None
        loaded_model = self.model_holder.get_loaded_model("order_risk")
        if request.order is not None:
            feature_values = build_order_risk_feature_values(request.order, usd_rate_lookup)
            bundle = loaded_model.bundle if loaded_model else None
            if isinstance(bundle, MultiHeadClassifierBundle) and bundle.feature_names == ORDER_RISK_FEATURE_NAMES:
                probabilities = bundle.predict_head_probabilities(np.asarray([feature_values], dtype=np.float64))
                model_score = float(probabilities["fraud"][0])
            log_served_feature_rows(
                self.feature_log_sink,
                request_id,
                RankingSurface.RISK,
                request.actor_id,
                [request.subject_id],
                {request.subject_id: feature_values},
                loaded_model.version if loaded_model and model_score is not None else None,
                ORDER_RISK_FEATURE_SCHEMA_VERSION,
                now,
            )
        final_score = rule_score
        if model_score is not None:
            final_score = max(rule_score, (1 - MODEL_BLEND_WEIGHT) * rule_score + MODEL_BLEND_WEIGHT * model_score)
        level, action = classify_risk_score(final_score)
        return RiskScoringResponse(
            subject_type=request.subject_type,
            subject_id=request.subject_id,
            score=round(final_score, 6),
            level=level,
            recommended_action=action,
            rule_score=round(rule_score, 6),
            model_score=None if model_score is None else round(model_score, 6),
            reasons=sorted(reasons, key=lambda reason: (-reason.weight, reason.code)),
            metadata=RankingResponseMetadata(
                request_id=request_id,
                ranking_source="risk:rules+model" if model_score is not None else "risk:rules",
                model_version=loaded_model.version if loaded_model and model_score is not None else None,
                degraded=needs_flow and not flow.available,
                generated_at=now,
            ),
        )
