from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

OpaqueIdentifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_\-:.]{1,128}$", min_length=1, max_length=128)]
TopicSlug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_\-]{1,64}$")]
CountryCode = Annotated[str, StringConstraints(pattern=r"^[A-Z]{2}$")]
RegionCode = Annotated[str, StringConstraints(pattern=r"^[A-Z0-9\-]{1,12}$")]
CurrencyCode = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
UnitInterval = Annotated[float, Field(ge=0.0, le=1.0)]
NonNegativeCount = Annotated[int, Field(ge=0, le=10**12)]
AgeBracket = Annotated[str, StringConstraints(pattern=r"^(13-17|18-24|25-34|35-44|45-54|55-64|65\+)$")]

MAXIMUM_TOPICS_PER_ITEM = 20
MAXIMUM_RANKING_CANDIDATES = 500
MAXIMUM_ID_LIST_LENGTH = 5000


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
