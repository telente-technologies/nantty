from decimal import Decimal

from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.risk.dtos.value_transfer_risk_dto import (
    CoinPurchaseRiskSignals,
    CoinTransferRiskSignals,
    GiftRiskSignals,
)
from src.modules.risk.services.risk_rules_service import (
    RiskRule,
    convert_money_to_usd_or_none,
    convert_triggered_rules_to_reasons,
    is_at_least,
    is_below,
)
from src.modules.risk.services.value_flow_feature_service import ValueFlowSignals


def evaluate_coin_purchase_risk_rules(
    signals: CoinPurchaseRiskSignals, usd_rate_lookup: dict[str, Decimal]
) -> list[RiskReason]:
    amount_usd = convert_money_to_usd_or_none(signals.amount, usd_rate_lookup)
    countries_known = signals.payment_country is not None and signals.account_country is not None
    rules: list[RiskRule] = [
        ("new_account_large_coin_purchase", 0.3, signals.account_age_hours < 24 and is_at_least(amount_usd, 100)),
        ("coin_purchase_velocity", 0.25, signals.purchases_last_day >= 5),
        ("repeated_payment_failures", 0.3, signals.failed_payment_attempts_last_day >= 3),
        (
            "new_payment_instrument_large_purchase",
            0.2,
            signals.is_new_payment_instrument and is_at_least(amount_usd, 100),
        ),
        ("device_shared_by_many_accounts", 0.3, signals.device_account_count >= 4),
        ("payment_country_mismatch", 0.15, countries_known and signals.payment_country != signals.account_country),
        ("exchange_rate_unavailable", 0.0, amount_usd is None),
    ]
    return convert_triggered_rules_to_reasons(rules)


def evaluate_coin_transfer_risk_rules(signals: CoinTransferRiskSignals, flow: ValueFlowSignals) -> list[RiskReason]:
    rules: list[RiskRule] = [
        ("sender_and_recipient_share_device", 0.45, signals.sender_and_recipient_share_device),
        ("reciprocal_transfer_ring", 0.35, flow.counterparty_previously_sent_to_actor),
        ("rapid_forwarding_of_received_coins", 0.3, is_below(signals.minutes_since_sender_received_these_coins, 30)),
        ("long_transfer_chain", 0.35, signals.observed_transfer_chain_depth_last_day >= 3),
        ("transfer_fan_out", 0.25, signals.sender_distinct_recipients_last_day >= 10),
        ("transfer_burst", 0.2, signals.sender_transfers_last_hour >= 10),
        (
            "recipient_is_collection_point",
            0.3,
            flow.counterparty_distinct_incoming_sources >= 20 and signals.recipient_account_age_hours < 168,
        ),
        (
            "both_accounts_new",
            0.2,
            signals.sender_account_age_hours < 48 and signals.recipient_account_age_hours < 48,
        ),
        (
            "new_account_drains_balance",
            0.15,
            signals.fraction_of_sender_balance >= 0.9 and signals.sender_account_age_hours < 72,
        ),
        ("coins_bought_with_new_instrument", 0.2, signals.coins_bought_with_new_instrument_last_day),
    ]
    return convert_triggered_rules_to_reasons(rules)


def evaluate_gift_risk_rules(signals: GiftRiskSignals, flow: ValueFlowSignals) -> list[RiskReason]:
    rules: list[RiskRule] = [
        ("sender_and_creator_share_device", 0.5, signals.sender_and_creator_share_device),
        ("gift_reciprocity_laundering", 0.4, flow.counterparty_previously_sent_to_actor),
        ("creator_income_concentrated_on_sender", 0.3, signals.sender_share_of_creator_gift_income_last_week >= 0.6),
        ("repeated_gifts_to_same_creator", 0.2, signals.gifts_from_sender_to_creator_last_day >= 20),
        (
            "new_sender_and_new_creator",
            0.25,
            signals.sender_account_age_hours < 72 and signals.creator_account_age_hours < 72,
        ),
        ("creator_cashes_out_quickly", 0.3, is_below(signals.hours_until_creator_payout_request, 24)),
        ("coins_bought_with_new_instrument", 0.2, signals.coins_bought_with_new_instrument_last_day),
    ]
    return convert_triggered_rules_to_reasons(rules)
