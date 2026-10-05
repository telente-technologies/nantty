from typing import Literal, Self

from pydantic import AwareDatetime, Field, model_validator

from src.dtos.common_dto import ContractModel, ExchangeRateToUsd, MoneyAmount, RankingResponseMetadata
from src.modules.risk.dtos.value_transfer_risk_dto import (
    CoinPurchaseRiskSignals,
    CoinTransferRiskSignals,
    GiftRiskSignals,
)
from src.validators.common_field_validator import CountryCode, OpaqueIdentifier, UnitInterval

RiskSubjectType = Literal["order", "payout", "account_event", "coin_purchase", "coin_transfer", "gift"]

RISK_SUBJECT_TYPES: tuple[RiskSubjectType, ...] = (
    "order",
    "payout",
    "account_event",
    "coin_purchase",
    "coin_transfer",
    "gift",
)


class OrderRiskSignals(ContractModel):
    amount: MoneyAmount
    account_age_hours: float = Field(ge=0, le=1e6)
    buyer_previous_order_count: int = Field(ge=0, le=1_000_000)
    buyer_median_order_amount: MoneyAmount | None = None
    orders_last_hour: int = Field(default=0, ge=0, le=100_000)
    failed_payment_attempts_last_day: int = Field(default=0, ge=0, le=100_000)
    shipping_country: CountryCode | None = None
    account_country: CountryCode | None = None
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    is_new_payment_instrument: bool = False
    buyer_and_seller_share_device: bool = False
    seller_account_age_hours: float = Field(default=10_000, ge=0, le=1e6)
    seller_dispute_rate: UnitInterval = 0.0


class PayoutRiskSignals(ContractModel):
    amount: MoneyAmount
    lifetime_earnings: MoneyAmount
    seller_account_age_hours: float = Field(ge=0, le=1e6)
    hours_since_payout_destination_changed: float | None = Field(default=None, ge=0, le=1e6)
    refund_rate: UnitInterval = 0.0
    dispute_rate: UnitInterval = 0.0
    payouts_last_day: int = Field(default=0, ge=0, le=100_000)
    payout_destination_country: CountryCode | None = None
    seller_country: CountryCode | None = None
    is_identity_verified: bool = False


class AccountEventRiskSignals(ContractModel):
    event_kind: Literal[
        "signup", "login", "password_change", "email_change", "phone_change", "payout_destination_change"
    ]
    is_new_device: bool = False
    is_new_country: bool = False
    failed_otp_attempts_last_hour: int = Field(default=0, ge=0, le=100_000)
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    hours_since_last_credential_change: float | None = Field(default=None, ge=0, le=1e6)
    signups_on_device_last_day: int = Field(default=0, ge=0, le=100_000)
    uses_anonymizing_network: bool = False


class RiskScoringRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    subject_type: RiskSubjectType
    subject_id: OpaqueIdentifier
    actor_id: OpaqueIdentifier
    exchange_rates: list[ExchangeRateToUsd] = Field(default_factory=list, max_length=50)
    order: OrderRiskSignals | None = None
    payout: PayoutRiskSignals | None = None
    account_event: AccountEventRiskSignals | None = None
    coin_purchase: CoinPurchaseRiskSignals | None = None
    coin_transfer: CoinTransferRiskSignals | None = None
    gift: GiftRiskSignals | None = None
    now: AwareDatetime | None = None

    @model_validator(mode="after")
    def require_signals_matching_subject_type(self) -> Self:
        provided = {subject_type: getattr(self, subject_type) is not None for subject_type in RISK_SUBJECT_TYPES}
        if not provided[self.subject_type] or sum(provided.values()) != 1:
            raise ValueError("exactly the signals block matching subjectType must be provided")
        return self


class RiskReason(ContractModel):
    code: str
    weight: float


class RiskScoringResponse(ContractModel):
    subject_type: RiskSubjectType
    subject_id: str
    score: float
    level: Literal["low", "medium", "high"]
    recommended_action: Literal["allow", "review", "hold_for_manual_review"]
    rule_score: float
    model_score: float | None
    reasons: list[RiskReason]
    metadata: RankingResponseMetadata
