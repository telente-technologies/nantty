from typing import Literal

from pydantic import AwareDatetime, Field

from src.dtos.common_dto import ContractModel, ExchangeRateToUsd, MoneyAmount, RankingResponseMetadata, ViewerContext
from src.validators.common_field_validator import (
    AgeBracket,
    CountryCode,
    NonNegativeCount,
    OpaqueIdentifier,
    RegionCode,
    TopicSlug,
    UnitInterval,
)

AdPlacement = Literal["feed", "clips", "mart", "search", "stories", "live", "live_discovery"]
AdMediaType = Literal["image", "video", "carousel", "live_stream", "product_tile"]
AdAspectRatio = Literal["1:1", "4:5", "9:16", "16:9"]
AdBidType = Literal["cpc", "cpm"]


class AdTargeting(ContractModel):
    countries: list[CountryCode] = Field(default_factory=list, max_length=250)
    regions: list[RegionCode] = Field(default_factory=list, max_length=500)
    topics: list[TopicSlug] = Field(default_factory=list, max_length=50)
    age_brackets: list[AgeBracket] = Field(default_factory=list, max_length=7)
    lookalike_store_id: OpaqueIdentifier | None = None
    lookalike_minimum_similarity: UnitInterval = 0.3


class AdCreative(ContractModel):
    media_type: AdMediaType
    aspect_ratio: AdAspectRatio
    duration_ms: int | None = Field(default=None, ge=0, le=600_000)
    is_live_now: bool = False
    product_id: OpaqueIdentifier | None = None
    live_stream_id: OpaqueIdentifier | None = None


class AdCandidate(ContractModel):
    ad_id: OpaqueIdentifier
    campaign_id: OpaqueIdentifier
    advertiser_id: OpaqueIdentifier
    status: Literal["active", "paused", "ended", "pending_review", "rejected"]
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    bid_type: AdBidType
    bid: MoneyAmount
    daily_budget: MoneyAmount
    total_budget: MoneyAmount | None = None
    spent_today: MoneyAmount
    spent_total: MoneyAmount
    frequency_cap_per_day: int = Field(default=3, ge=1, le=50)
    placements: list[AdPlacement] = Field(min_length=1, max_length=7)
    targeting: AdTargeting = Field(default_factory=AdTargeting)
    creative: AdCreative
    brand_safety: Literal["strict", "standard"] = "standard"
    day_start_utc_offset_minutes: int = Field(default=60, ge=-720, le=840)
    creative_topics: list[TopicSlug] = Field(default_factory=list, max_length=20)
    lifetime_impressions: NonNegativeCount = 0
    lifetime_clicks: NonNegativeCount = 0


class OrganicSlotItem(ContractModel):
    item_id: OpaqueIdentifier
    is_sensitive: bool = False
    is_reported: bool = False


class AdLoadOptions(ContractModel):
    first_ad_after_organic_items: int | None = Field(default=None, ge=0, le=50)
    organic_items_between_ads: int | None = Field(default=None, ge=1, le=50)
    maximum_ads: int = Field(default=5, ge=0, le=20)
    grid_columns: int = Field(default=2, ge=1, le=6)


class AdSelectionRequest(ContractModel):
    request_id: OpaqueIdentifier | None = None
    placement: AdPlacement
    host_content_id: OpaqueIdentifier | None = None
    host_creator_id: OpaqueIdentifier | None = None
    host_content_is_sensitive: bool = False
    host_content_is_reported: bool = False
    viewer: ViewerContext
    organic_items: list[OrganicSlotItem] = Field(max_length=200)
    candidates: list[AdCandidate] = Field(max_length=300)
    exchange_rates: list[ExchangeRateToUsd] = Field(min_length=1, max_length=50)
    reserve_price_per_mille: MoneyAmount | None = None
    ad_load: AdLoadOptions = Field(default_factory=AdLoadOptions)
    viewer_impressions_today_by_campaign: dict[OpaqueIdentifier, int] = Field(default_factory=dict, max_length=500)
    now: AwareDatetime | None = None


class AdPlacementDecision(ContractModel):
    ad_id: OpaqueIdentifier
    campaign_id: OpaqueIdentifier
    advertiser_id: OpaqueIdentifier
    placement: AdPlacement
    position: int
    insert_after_item_id: OpaqueIdentifier | None
    host_content_id: OpaqueIdentifier | None
    host_creator_id: OpaqueIdentifier | None
    charge_model: AdBidType
    charge_price: MoneyAmount
    creative_media_type: AdMediaType
    predicted_click_rate: float
    auction_id: str


class RejectedAd(ContractModel):
    ad_id: OpaqueIdentifier
    reason: str


class AdSelectionResponse(ContractModel):
    placements: list[AdPlacementDecision]
    rejected: list[RejectedAd]
    metadata: RankingResponseMetadata
