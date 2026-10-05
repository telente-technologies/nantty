import math
from collections.abc import Sequence
from decimal import Decimal

from src.dtos.common_dto import MoneyAmount
from src.modules.risk.dtos.risk_scoring_dto import (
    AccountEventRiskSignals,
    OrderRiskSignals,
    PayoutRiskSignals,
    RiskReason,
)
from src.services.currency_conversion_service import convert_money_to_usd_micros

type RiskRule = tuple[str, float, bool]
CREDENTIAL_CHANGE_EVENTS = frozenset({"password_change", "email_change", "payout_destination_change"})

ORDER_RISK_FEATURE_SCHEMA_VERSION = 1
ORDER_RISK_FEATURE_NAMES: tuple[str, ...] = (
    "log_amount_usd",
    "log_account_age_hours",
    "log_buyer_previous_order_count",
    "log_amount_to_median_ratio",
    "orders_last_hour",
    "failed_payment_attempts_last_day",
    "shipping_country_mismatch",
    "device_account_count",
    "is_new_payment_instrument",
    "buyer_and_seller_share_device",
    "log_seller_account_age_hours",
    "seller_dispute_rate",
)


def convert_money_to_usd_or_none(money: MoneyAmount, usd_rate_lookup: dict[str, Decimal]) -> float | None:
    usd_micros = convert_money_to_usd_micros(money, usd_rate_lookup)
    return None if usd_micros is None else float(usd_micros) / 1_000_000


def is_at_least(value: float | None, threshold: float) -> bool:
    return value is not None and value >= threshold


def is_below(value: float | None, threshold: float) -> bool:
    return value is not None and value < threshold


def convert_triggered_rules_to_reasons(rules: Sequence[RiskRule]) -> list[RiskReason]:
    return [RiskReason(code=code, weight=weight) for code, weight, triggered in rules if triggered]


def combine_rule_weights_with_noisy_or(reasons: Sequence[RiskReason]) -> float:
    probability_of_no_fraud = 1.0
    for reason in reasons:
        probability_of_no_fraud *= 1.0 - min(max(reason.weight, 0.0), 0.99)
    return 1.0 - probability_of_no_fraud


def calculate_amount_to_median_ratio(signals: OrderRiskSignals) -> float | None:
    median = signals.buyer_median_order_amount
    if median is None or median.currency != signals.amount.currency or median.amount_minor <= 0:
        return None
    return signals.amount.amount_minor / median.amount_minor


def evaluate_order_risk_rules(signals: OrderRiskSignals, usd_rate_lookup: dict[str, Decimal]) -> list[RiskReason]:
    amount_usd = convert_money_to_usd_or_none(signals.amount, usd_rate_lookup)
    countries_known = signals.shipping_country is not None and signals.account_country is not None
    rules: list[RiskRule] = [
        ("new_account_high_value", 0.35, signals.account_age_hours < 24 and is_at_least(amount_usd, 200)),
        ("amount_far_above_buyer_median", 0.25, is_at_least(calculate_amount_to_median_ratio(signals), 10)),
        ("first_order_high_value", 0.2, signals.buyer_previous_order_count == 0 and is_at_least(amount_usd, 500)),
        ("order_velocity", 0.3, signals.orders_last_hour >= 5),
        ("repeated_payment_failures", 0.3, signals.failed_payment_attempts_last_day >= 3),
        ("shipping_country_mismatch", 0.15, countries_known and signals.shipping_country != signals.account_country),
        ("device_shared_by_many_accounts", 0.3, signals.device_account_count >= 4),
        ("new_payment_instrument_high_value", 0.2, signals.is_new_payment_instrument and is_at_least(amount_usd, 300)),
        ("buyer_and_seller_share_device", 0.5, signals.buyer_and_seller_share_device),
        ("new_seller_high_value", 0.2, signals.seller_account_age_hours < 72 and is_at_least(amount_usd, 300)),
        ("seller_dispute_rate_high", 0.25, signals.seller_dispute_rate >= 0.1),
        ("exchange_rate_unavailable", 0.0, amount_usd is None),
    ]
    return convert_triggered_rules_to_reasons(rules)


def build_order_risk_feature_values(signals: OrderRiskSignals, usd_rate_lookup: dict[str, Decimal]) -> list[float]:
    amount_usd = convert_money_to_usd_or_none(signals.amount, usd_rate_lookup) or 0.0
    ratio = calculate_amount_to_median_ratio(signals)
    countries_known = signals.shipping_country is not None and signals.account_country is not None
    return [
        math.log1p(amount_usd),
        math.log1p(signals.account_age_hours),
        math.log1p(signals.buyer_previous_order_count),
        math.log(ratio) if ratio and ratio > 0 else 0.0,
        float(min(signals.orders_last_hour, 100)),
        float(min(signals.failed_payment_attempts_last_day, 100)),
        1.0 if countries_known and signals.shipping_country != signals.account_country else 0.0,
        float(min(signals.device_account_count, 100)),
        1.0 if signals.is_new_payment_instrument else 0.0,
        1.0 if signals.buyer_and_seller_share_device else 0.0,
        math.log1p(signals.seller_account_age_hours),
        signals.seller_dispute_rate,
    ]


def evaluate_payout_risk_rules(signals: PayoutRiskSignals) -> list[RiskReason]:
    same_currency = signals.amount.currency == signals.lifetime_earnings.currency
    exceeds_earnings = same_currency and signals.amount.amount_minor > signals.lifetime_earnings.amount_minor
    near_full_balance = same_currency and signals.amount.amount_minor >= 0.9 * signals.lifetime_earnings.amount_minor
    destination_change_hours = signals.hours_since_payout_destination_changed
    countries_known = signals.payout_destination_country is not None and signals.seller_country is not None
    rules: list[RiskRule] = [
        ("payout_destination_changed_last_day", 0.4, is_below(destination_change_hours, 24)),
        (
            "payout_destination_changed_last_three_days",
            0.2,
            is_below(destination_change_hours, 72) and not is_below(destination_change_hours, 24),
        ),
        ("new_seller_payout", 0.2, signals.seller_account_age_hours < 168),
        ("payout_exceeds_lifetime_earnings", 0.6, exceeds_earnings),
        ("full_balance_payout_new_account", 0.2, near_full_balance and signals.seller_account_age_hours < 336),
        ("high_refund_rate", 0.25, signals.refund_rate >= 0.2),
        ("high_dispute_rate", 0.3, signals.dispute_rate >= 0.1),
        ("payout_velocity", 0.25, signals.payouts_last_day >= 3),
        (
            "payout_country_mismatch",
            0.2,
            countries_known and signals.payout_destination_country != signals.seller_country,
        ),
        ("identity_not_verified", 0.3, not signals.is_identity_verified),
        ("payout_currency_differs_from_earnings", 0.1, not same_currency),
    ]
    return convert_triggered_rules_to_reasons(rules)


def evaluate_account_event_risk_rules(signals: AccountEventRiskSignals) -> list[RiskReason]:
    changing_credentials = signals.event_kind in CREDENTIAL_CHANGE_EVENTS
    recent_credential_change = is_below(signals.hours_since_last_credential_change, 24)
    rules: list[RiskRule] = [
        ("new_device_and_new_country", 0.35, signals.is_new_device and signals.is_new_country),
        ("new_country", 0.15, signals.is_new_country and not signals.is_new_device),
        ("otp_bruteforce", 0.4, signals.failed_otp_attempts_last_hour >= 5),
        ("device_shared_by_many_accounts", 0.3, signals.device_account_count >= 5),
        (
            "credential_change_takeover_pattern",
            0.4,
            changing_credentials and signals.is_new_device and recent_credential_change,
        ),
        ("signup_farm", 0.45, signals.event_kind == "signup" and signals.signups_on_device_last_day >= 3),
        ("anonymizing_network", 0.15, signals.uses_anonymizing_network),
        (
            "payout_destination_change_on_new_device",
            0.3,
            signals.event_kind == "payout_destination_change" and signals.is_new_device,
        ),
    ]
    return convert_triggered_rules_to_reasons(rules)
