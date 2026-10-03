from typing import Literal, Self

from pydantic import AwareDatetime, Field, model_validator

from src.dtos.common_dto import ContractModel, ExchangeRateToUsd, MoneyAmount, RankingResponseMetadata
from src.modules.risk.dtos.risk_scoring_dto import RiskReason
from src.validators.common_field_validator import CountryCode, NonNegativeCount, OpaqueIdentifier, UnitInterval

ExtendedRiskSubjectType = Literal["account", "payment", "ad_click", "referral_removed", "refund", "marketplace"]
EXTENDED_RISK_SUBJECT_TYPES: tuple[ExtendedRiskSubjectType, ...] = (
    "account",
    "payment",
    "ad_click",
    "referral_removed",
    "refund",
    "marketplace",
)
SUSPENSION_ELIGIBLE_SUBJECT_TYPES = frozenset({"account", "ad_click", "referral_removed", "marketplace"})


class AccountRiskSignals(ContractModel):
    account_age_hours: float = Field(ge=0, le=1e6)
    signups_on_device_last_day: NonNegativeCount = 0
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    failed_logins_last_hour: NonNegativeCount = 0
    reports_received_last_7_days: NonNegativeCount = 0
    blocks_received_last_7_days: NonNegativeCount = 0
    shares_instrument_with_banned_account: bool = False
    uses_anonymizing_network: bool = False
    chat_spam_score: UnitInterval | None = None
    prior_suspensions: NonNegativeCount = 0


class PaymentRiskSignals(ContractModel):
    amount: MoneyAmount
    account_age_hours: float = Field(ge=0, le=1e6)
    failed_attempts_last_hour: NonNegativeCount = 0
    distinct_cards_last_day: NonNegativeCount = 0
    is_new_payment_instrument: bool = False
    billing_country: CountryCode | None = None
    ip_country: CountryCode | None = None
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    chargebacks_last_90_days: NonNegativeCount = 0


class AdClickRiskSignals(ContractModel):
    clicks_by_actor_last_hour: NonNegativeCount = 0
    clicks_from_device_last_hour: NonNegativeCount = 0
    distinct_campaigns_clicked_last_hour: NonNegativeCount = 0
    milliseconds_from_impression_to_click: int | None = Field(default=None, ge=0, le=86_400_000)
    is_datacenter_ip: bool = False
    clicker_and_advertiser_share_device: bool = False
    clicker_account_age_hours: float = Field(default=10_000, ge=0, le=1e6)


class ReferralRemovedRiskSignals(ContractModel):
    removal_reason: Literal["referee_deleted", "fake_account", "self_referral", "chargeback"]
    referrals_removed_last_30_days: NonNegativeCount = 0
    referrals_total_last_30_days: NonNegativeCount = 0
    referee_shares_device_with_referrer: bool = False
    referee_account_age_hours_at_removal: float = Field(default=10_000, ge=0, le=1e6)


class RefundRiskSignals(ContractModel):
    amount: MoneyAmount
    order_amount: MoneyAmount
    buyer_account_age_hours: float = Field(ge=0, le=1e6)
    buyer_refunds_last_30_days: NonNegativeCount = 0
    buyer_refund_rate_last_90_days: UnitInterval = 0.0
    hours_since_delivery: float | None = Field(default=None, ge=0, le=1e6)
    item_not_received_claim: bool = False
    seller_refund_rate: UnitInterval = 0.0
    buyer_and_seller_share_device: bool = False


class MarketplaceRiskSignals(ContractModel):
    seller_account_age_hours: float = Field(ge=0, le=1e6)
    listings_created_last_day: NonNegativeCount = 0
    price_to_category_median_ratio: float | None = Field(default=None, ge=0, le=10_000)
    duplicate_listing_count: NonNegativeCount = 0
    seller_dispute_rate: UnitInterval = 0.0
    seller_report_rate: UnitInterval = 0.0
    off_platform_contact_reports: NonNegativeCount = 0
    prohibited_category_hit: bool = False


class ExtendedRiskRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    subject_type: ExtendedRiskSubjectType
    subject_id: OpaqueIdentifier
    actor_id: OpaqueIdentifier
    exchange_rates: list[ExchangeRateToUsd] = Field(default_factory=list, max_length=50)
    account: AccountRiskSignals | None = None
    payment: PaymentRiskSignals | None = None
    ad_click: AdClickRiskSignals | None = None
    referral_removed: ReferralRemovedRiskSignals | None = None
    refund: RefundRiskSignals | None = None
    marketplace: MarketplaceRiskSignals | None = None
    now: AwareDatetime | None = None

    @model_validator(mode="after")
    def require_signals_matching_subject_type(self) -> Self:
        provided = {name: getattr(self, name) is not None for name in EXTENDED_RISK_SUBJECT_TYPES}
        if not provided[self.subject_type] or sum(provided.values()) != 1:
            raise ValueError("exactly the signals block matching subjectType must be provided")
        return self


class ExtendedRiskResponse(ContractModel):
    subject_type: ExtendedRiskSubjectType
    subject_id: str
    score: float
    level: Literal["low", "medium", "high"]
    recommended_action: Literal["allow", "review", "hold_for_manual_review"]
    reasons: list[RiskReason]
    suspension_suggested: bool
    metadata: RankingResponseMetadata
