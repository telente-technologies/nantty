from decimal import Decimal

from src.modules.extended_risk.dtos.extended_risk_dto import (
    AccountRiskSignals,
    AdClickRiskSignals,
    ExtendedRiskRequest,
    MarketplaceRiskSignals,
    PaymentRiskSignals,
    ReferralRemovedRiskSignals,
    RefundRiskSignals,
)
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.modules.risk.services.risk_rules_service import (
    convert_money_to_usd_or_none,
    convert_triggered_rules_to_reasons,
    is_at_least,
)

type Rules = list[tuple[str, float, bool]]
HIGH_VALUE_USD = 300.0
HIGH_REFUND_USD = 150.0


def evaluate_account_rules(signals: AccountRiskSignals) -> Rules:
    return [
        ("brand_new_account", 0.1, signals.account_age_hours < 2),
        ("signup_farm_device", 0.45, signals.signups_on_device_last_day >= 3),
        ("shared_device_cluster", 0.3, signals.device_account_count >= 4),
        ("credential_stuffing_pattern", 0.4, signals.failed_logins_last_hour >= 10),
        ("reported_by_many", 0.4, signals.reports_received_last_7_days >= 5),
        ("blocked_by_many", 0.3, signals.blocks_received_last_7_days >= 10),
        ("shares_instrument_with_banned_account", 0.65, signals.shares_instrument_with_banned_account),
        ("anonymizing_network", 0.15, signals.uses_anonymizing_network),
        ("high_chat_spam_score", 0.45, (signals.chat_spam_score or 0.0) >= 0.7),
        ("prior_suspension", 0.35, signals.prior_suspensions >= 1),
    ]


def evaluate_payment_rules(signals: PaymentRiskSignals, rates: dict[str, Decimal]) -> Rules:
    amount_usd = convert_money_to_usd_or_none(signals.amount, rates)
    country_mismatch = (
        signals.billing_country is not None
        and signals.ip_country is not None
        and signals.billing_country != signals.ip_country
    )
    return [
        ("new_account_high_value", 0.5, signals.account_age_hours < 24 and is_at_least(amount_usd, HIGH_VALUE_USD)),
        ("card_testing_failures", 0.55, signals.failed_attempts_last_hour >= 4),
        ("many_cards_in_a_day", 0.5, signals.distinct_cards_last_day >= 3),
        (
            "new_instrument_high_value",
            0.25,
            signals.is_new_payment_instrument and is_at_least(amount_usd, HIGH_VALUE_USD),
        ),
        ("billing_ip_country_mismatch", 0.25, country_mismatch),
        ("shared_device_cluster", 0.25, signals.device_account_count >= 4),
        ("prior_chargebacks", 0.5, signals.chargebacks_last_90_days >= 1),
    ]


def evaluate_ad_click_rules(signals: AdClickRiskSignals) -> Rules:
    too_fast = (
        signals.milliseconds_from_impression_to_click is not None
        and signals.milliseconds_from_impression_to_click < 300
    )
    return [
        ("click_velocity_actor", 0.55, signals.clicks_by_actor_last_hour >= 15),
        ("click_velocity_device", 0.5, signals.clicks_from_device_last_hour >= 25),
        ("many_campaigns_clicked", 0.3, signals.distinct_campaigns_clicked_last_hour >= 10),
        ("impossibly_fast_click", 0.45, too_fast),
        ("datacenter_ip", 0.5, signals.is_datacenter_ip),
        ("clicker_shares_device_with_advertiser", 0.75, signals.clicker_and_advertiser_share_device),
        ("new_clicker_account", 0.15, signals.clicker_account_age_hours < 6),
    ]


def evaluate_referral_removed_rules(signals: ReferralRemovedRiskSignals) -> Rules:
    removal_rate = (
        signals.referrals_removed_last_30_days / signals.referrals_total_last_30_days
        if signals.referrals_total_last_30_days
        else 0.0
    )
    return [
        ("self_referral_removed", 0.8, signals.removal_reason == "self_referral"),
        ("fake_account_removed", 0.6, signals.removal_reason == "fake_account"),
        ("chargeback_removed", 0.4, signals.removal_reason == "chargeback"),
        ("high_removal_rate", 0.5, signals.referrals_total_last_30_days >= 5 and removal_rate >= 0.5),
        ("referee_shares_device", 0.5, signals.referee_shares_device_with_referrer),
        ("referee_removed_within_a_day", 0.25, signals.referee_account_age_hours_at_removal < 24),
    ]


def evaluate_refund_rules(signals: RefundRiskSignals, rates: dict[str, Decimal]) -> Rules:
    amount_usd = convert_money_to_usd_or_none(signals.amount, rates)
    return [
        ("high_refund_rate_buyer", 0.5, signals.buyer_refund_rate_last_90_days >= 0.4),
        ("frequent_refunds_buyer", 0.35, signals.buyer_refunds_last_30_days >= 4),
        (
            "new_buyer_high_refund",
            0.4,
            signals.buyer_account_age_hours < 72 and is_at_least(amount_usd, HIGH_REFUND_USD),
        ),
        (
            "not_received_after_delivery",
            0.35,
            signals.item_not_received_claim and signals.hours_since_delivery is not None,
        ),
        ("seller_refund_pattern", 0.2, signals.seller_refund_rate >= 0.3),
        ("buyer_and_seller_share_device", 0.7, signals.buyer_and_seller_share_device),
    ]


def evaluate_marketplace_rules(signals: MarketplaceRiskSignals) -> Rules:
    cheap = signals.price_to_category_median_ratio is not None and signals.price_to_category_median_ratio < 0.2
    return [
        (
            "new_seller_listing_burst",
            0.45,
            signals.seller_account_age_hours < 72 and signals.listings_created_last_day >= 30,
        ),
        ("price_far_below_category", 0.4, cheap),
        ("duplicate_listings", 0.4, signals.duplicate_listing_count >= 5),
        ("seller_dispute_rate_high", 0.45, signals.seller_dispute_rate >= 0.15),
        ("seller_report_rate_high", 0.4, signals.seller_report_rate >= 0.1),
        ("off_platform_contact_reports", 0.5, signals.off_platform_contact_reports >= 2),
        ("prohibited_category_hit", 0.85, signals.prohibited_category_hit),
    ]


def evaluate_extended_risk_rules(request: ExtendedRiskRequest, rates: dict[str, Decimal]) -> list[RiskReason]:
    rules: Rules = []
    if request.account is not None:
        rules = evaluate_account_rules(request.account)
    elif request.payment is not None:
        rules = evaluate_payment_rules(request.payment, rates)
    elif request.ad_click is not None:
        rules = evaluate_ad_click_rules(request.ad_click)
    elif request.referral_removed is not None:
        rules = evaluate_referral_removed_rules(request.referral_removed)
    elif request.refund is not None:
        rules = evaluate_refund_rules(request.refund, rates)
    elif request.marketplace is not None:
        rules = evaluate_marketplace_rules(request.marketplace)
    return convert_triggered_rules_to_reasons(rules)
