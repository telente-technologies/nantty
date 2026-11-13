from typing import Literal

from pydantic import Field

from src.dtos.common_dto import ContractModel, MoneyAmount
from src.validators.common_field_validator import MAXIMUM_TOPICS_PER_ITEM, NonNegativeCount, OpaqueIdentifier, TopicSlug

TargetType = Literal["post", "clip", "story", "live", "product", "store", "account", "comment", "ad"]


class ItemTopicsMixin(ContractModel):
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)
    hashtags: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)


class PostViewedPayload(ItemTopicsMixin):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier
    dwell_ms: int = Field(ge=0, le=3_600_000)
    position: int | None = Field(default=None, ge=0, le=10_000)
    is_product_post: bool = False


class PostLikedPayload(ItemTopicsMixin):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier


class CommentedPayload(ItemTopicsMixin):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier


class SharedPayload(ItemTopicsMixin):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier
    channel: Literal["in_app", "external", "message", "story"] = "in_app"


class FollowedPayload(ContractModel):
    target_account_id: OpaqueIdentifier
    target_kind: Literal["user", "store"]


class ClipWatchedPayload(ItemTopicsMixin):
    clip_id: OpaqueIdentifier
    creator_id: OpaqueIdentifier
    watch_fraction: float = Field(ge=0.0, le=1.0)
    loop_count: int = Field(default=0, ge=0, le=100)
    duration_ms: int = Field(ge=0, le=3_600_000)


class ProductViewedPayload(ItemTopicsMixin):
    product_id: OpaqueIdentifier
    store_id: OpaqueIdentifier
    source_post_id: OpaqueIdentifier | None = None
    category_id: OpaqueIdentifier | None = None
    price: MoneyAmount | None = None


class AddedToCartPayload(ContractModel):
    product_id: OpaqueIdentifier
    store_id: OpaqueIdentifier
    quantity: int = Field(ge=1, le=10_000)
    source_post_id: OpaqueIdentifier | None = None


class PurchasedItem(ContractModel):
    product_id: OpaqueIdentifier
    quantity: int = Field(ge=1, le=10_000)
    unit_price: MoneyAmount


class PurchasedPayload(ContractModel):
    order_id: OpaqueIdentifier
    store_id: OpaqueIdentifier
    items: list[PurchasedItem] = Field(min_length=1, max_length=200)
    source_post_id: OpaqueIdentifier | None = None


class SearchedPayload(ContractModel):
    query_hash: OpaqueIdentifier
    result_count: NonNegativeCount
    clicked_item_id: OpaqueIdentifier | None = None
    clicked_item_type: TargetType | None = None
    position: int | None = Field(default=None, ge=0, le=10_000)


class AdImpressionPayload(ContractModel):
    ad_id: OpaqueIdentifier
    campaign_id: OpaqueIdentifier
    advertiser_id: OpaqueIdentifier
    auction_id: OpaqueIdentifier
    placement: Literal["feed", "clips", "mart", "search", "stories", "live", "live_discovery"]
    host_content_id: OpaqueIdentifier | None = None
    host_creator_id: OpaqueIdentifier | None = None
    charge: MoneyAmount | None = None


class AdClickPayload(ContractModel):
    ad_id: OpaqueIdentifier
    campaign_id: OpaqueIdentifier
    auction_id: OpaqueIdentifier
    charge: MoneyAmount | None = None


class AdConversionPayload(ContractModel):
    ad_id: OpaqueIdentifier
    campaign_id: OpaqueIdentifier
    order_id: OpaqueIdentifier
    value: MoneyAmount


class ReportedPayload(ContractModel):
    target_id: OpaqueIdentifier
    target_type: TargetType
    target_author_id: OpaqueIdentifier | None = None
    reason_code: Literal["spam", "scam", "nudity", "violence", "hate", "counterfeit", "harassment", "other"]


class HiddenPayload(ContractModel):
    target_id: OpaqueIdentifier
    target_type: TargetType
    target_author_id: OpaqueIdentifier | None = None
    topics: list[TopicSlug] = Field(default_factory=list, max_length=MAXIMUM_TOPICS_PER_ITEM)


class RiskOutcomeLabeledPayload(ContractModel):
    subject_type: Literal["order", "payout", "account_event", "coin_purchase", "coin_transfer", "gift"]
    subject_id: OpaqueIdentifier
    outcome: Literal["fraud_confirmed", "fraud_cleared"]


class CoinTransferredPayload(ContractModel):
    transfer_id: OpaqueIdentifier
    recipient_id: OpaqueIdentifier
    coin_amount: int = Field(ge=1, le=10**12)


class GiftSentPayload(ContractModel):
    gift_id: OpaqueIdentifier
    creator_id: OpaqueIdentifier
    coin_amount: int = Field(ge=1, le=10**12)
    host_content_id: OpaqueIdentifier | None = None


class GiftValueFlowPayload(ContractModel):
    """Minimal pseudonymous fields needed to score gift value-flow signals."""

    creator_id: OpaqueIdentifier
    coin_amount: int = Field(ge=1, le=10**12)


class SavedPayload(ItemTopicsMixin):
    target_id: OpaqueIdentifier
    target_type: Literal["post", "clip", "product"]
    author_id: OpaqueIdentifier | None = None
