from pydantic import Field

from src.dtos.common_dto import ContractModel, MoneyAmount
from src.validators.common_field_validator import CountryCode, OpaqueIdentifier, UnitInterval

MAXIMUM_COINS = 10**12


class CoinPurchaseRiskSignals(ContractModel):
    amount: MoneyAmount
    coin_amount: int = Field(ge=0, le=MAXIMUM_COINS)
    account_age_hours: float = Field(ge=0, le=1e6)
    purchases_last_day: int = Field(default=0, ge=0, le=100_000)
    failed_payment_attempts_last_day: int = Field(default=0, ge=0, le=100_000)
    is_new_payment_instrument: bool = False
    device_account_count: int = Field(default=1, ge=0, le=100_000)
    payment_country: CountryCode | None = None
    account_country: CountryCode | None = None


class CoinTransferRiskSignals(ContractModel):
    recipient_id: OpaqueIdentifier
    coin_amount: int = Field(ge=0, le=MAXIMUM_COINS)
    fraction_of_sender_balance: UnitInterval = 0.0
    sender_account_age_hours: float = Field(ge=0, le=1e6)
    recipient_account_age_hours: float = Field(ge=0, le=1e6)
    sender_and_recipient_share_device: bool = False
    sender_transfers_last_hour: int = Field(default=0, ge=0, le=100_000)
    sender_distinct_recipients_last_day: int = Field(default=0, ge=0, le=100_000)
    minutes_since_sender_received_these_coins: float | None = Field(default=None, ge=0, le=1e6)
    observed_transfer_chain_depth_last_day: int = Field(default=0, ge=0, le=1000)
    coins_bought_with_new_instrument_last_day: bool = False


class GiftRiskSignals(ContractModel):
    creator_id: OpaqueIdentifier
    coin_amount: int = Field(ge=0, le=MAXIMUM_COINS)
    sender_account_age_hours: float = Field(ge=0, le=1e6)
    creator_account_age_hours: float = Field(ge=0, le=1e6)
    sender_and_creator_share_device: bool = False
    gifts_from_sender_to_creator_last_day: int = Field(default=0, ge=0, le=100_000)
    sender_share_of_creator_gift_income_last_week: UnitInterval = 0.0
    coins_bought_with_new_instrument_last_day: bool = False
    hours_until_creator_payout_request: float | None = Field(default=None, ge=0, le=1e6)
