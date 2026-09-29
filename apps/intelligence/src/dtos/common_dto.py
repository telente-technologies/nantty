from datetime import datetime
from decimal import Decimal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from src.validators.common_field_validator import (
    MAXIMUM_ID_LIST_LENGTH,
    AgeBracket,
    CountryCode,
    CurrencyCode,
    OpaqueIdentifier,
    RegionCode,
    TopicSlug,
)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
        str_strip_whitespace=False,
    )


class MoneyAmount(ContractModel):
    amount_minor: int = Field(ge=0, le=10**15)
    currency: CurrencyCode


class ExchangeRateToUsd(ContractModel):
    currency: CurrencyCode
    usd_per_major_unit: Decimal = Field(gt=0, max_digits=24, decimal_places=12)


class ViewerContext(ContractModel):
    user_id: OpaqueIdentifier
    country: CountryCode | None = None
    region: RegionCode | None = None
    chosen_topics: list[TopicSlug] = Field(default_factory=list, max_length=50)
    age_bracket: AgeBracket | None = None
    followed_account_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=MAXIMUM_ID_LIST_LENGTH)
    blocked_account_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=MAXIMUM_ID_LIST_LENGTH)
    muted_account_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=MAXIMUM_ID_LIST_LENGTH)
    hidden_item_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=MAXIMUM_ID_LIST_LENGTH)
    seen_item_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=MAXIMUM_ID_LIST_LENGTH)


class ExcludedItem(ContractModel):
    item_id: OpaqueIdentifier
    reason: str


class RankingResponseMetadata(ContractModel):
    request_id: str
    ranking_source: str
    model_version: str | None = None
    degraded: bool = False
    generated_at: datetime


class RequestTimestampMixin(ContractModel):
    now: AwareDatetime | None = None
