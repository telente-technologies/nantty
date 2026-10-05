from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, Field, JsonValue, TypeAdapter

from src.dtos.common_dto import ContractModel
from src.events.event_payload_dto import (
    AdClickPayload,
    AdConversionPayload,
    AddedToCartPayload,
    AdImpressionPayload,
    ClipWatchedPayload,
    CoinTransferredPayload,
    CommentedPayload,
    FollowedPayload,
    GiftSentPayload,
    HiddenPayload,
    PostLikedPayload,
    PostViewedPayload,
    ProductViewedPayload,
    PurchasedPayload,
    ReportedPayload,
    RiskOutcomeLabeledPayload,
    SavedPayload,
    SearchedPayload,
    SharedPayload,
)
from src.validators.common_field_validator import CountryCode, OpaqueIdentifier, RegionCode

MAXIMUM_EVENTS_PER_BATCH = 500


class EventContext(ContractModel):
    surface: str | None = Field(default=None, max_length=40, pattern=r"^[a-z_]{1,40}$")
    ranking_request_id: OpaqueIdentifier | None = None
    experiment_assignments: dict[str, str] = Field(default_factory=dict, max_length=20)
    device_class: Literal["android", "ios", "web", "other"] | None = None
    actor_trust: Literal["new", "low", "normal"] | None = None
    actor_cluster_key: OpaqueIdentifier | None = None


class EventEnvelopeBase(ContractModel):
    event_id: OpaqueIdentifier
    event_version: Literal[1] = 1
    occurred_at: AwareDatetime
    producer: str = Field(default="api", max_length=40, pattern=r"^[a-z_\-]{1,40}$")
    actor_id: OpaqueIdentifier
    country: CountryCode | None = None
    region: RegionCode | None = None
    context: EventContext = Field(default_factory=EventContext)


class PostViewedEvent(EventEnvelopeBase):
    event_type: Literal["post_viewed"]
    payload: PostViewedPayload


class PostLikedEvent(EventEnvelopeBase):
    event_type: Literal["post_liked"]
    payload: PostLikedPayload


class CommentedEvent(EventEnvelopeBase):
    event_type: Literal["commented"]
    payload: CommentedPayload


class SharedEvent(EventEnvelopeBase):
    event_type: Literal["shared"]
    payload: SharedPayload


class FollowedEvent(EventEnvelopeBase):
    event_type: Literal["followed"]
    payload: FollowedPayload


class ClipWatchedEvent(EventEnvelopeBase):
    event_type: Literal["clip_watched"]
    payload: ClipWatchedPayload


class ProductViewedEvent(EventEnvelopeBase):
    event_type: Literal["product_viewed"]
    payload: ProductViewedPayload


class AddedToCartEvent(EventEnvelopeBase):
    event_type: Literal["added_to_cart"]
    payload: AddedToCartPayload


class PurchasedEvent(EventEnvelopeBase):
    event_type: Literal["purchased"]
    payload: PurchasedPayload


class SearchedEvent(EventEnvelopeBase):
    event_type: Literal["searched"]
    payload: SearchedPayload


class AdImpressionEvent(EventEnvelopeBase):
    event_type: Literal["ad_impression"]
    payload: AdImpressionPayload


class AdClickEvent(EventEnvelopeBase):
    event_type: Literal["ad_click"]
    payload: AdClickPayload


class AdConversionEvent(EventEnvelopeBase):
    event_type: Literal["ad_conversion"]
    payload: AdConversionPayload


class ReportedEvent(EventEnvelopeBase):
    event_type: Literal["reported"]
    payload: ReportedPayload


class HiddenEvent(EventEnvelopeBase):
    event_type: Literal["hidden"]
    payload: HiddenPayload


class RiskOutcomeLabeledEvent(EventEnvelopeBase):
    event_type: Literal["risk_outcome_labeled"]
    payload: RiskOutcomeLabeledPayload


class CoinTransferredEvent(EventEnvelopeBase):
    event_type: Literal["coin_transferred"]
    payload: CoinTransferredPayload


class GiftSentEvent(EventEnvelopeBase):
    event_type: Literal["gift_sent"]
    payload: GiftSentPayload


class SavedEvent(EventEnvelopeBase):
    event_type: Literal["saved"]
    payload: SavedPayload


type IntelligenceEvent = Annotated[
    PostViewedEvent
    | PostLikedEvent
    | CommentedEvent
    | SharedEvent
    | FollowedEvent
    | ClipWatchedEvent
    | ProductViewedEvent
    | AddedToCartEvent
    | PurchasedEvent
    | SearchedEvent
    | AdImpressionEvent
    | AdClickEvent
    | AdConversionEvent
    | ReportedEvent
    | HiddenEvent
    | RiskOutcomeLabeledEvent
    | CoinTransferredEvent
    | GiftSentEvent
    | SavedEvent,
    Field(discriminator="event_type"),
]

intelligence_event_type_adapter: TypeAdapter[IntelligenceEvent] = TypeAdapter(IntelligenceEvent)

SUPPORTED_EVENT_TYPES: tuple[str, ...] = (
    "post_viewed",
    "post_liked",
    "commented",
    "shared",
    "followed",
    "clip_watched",
    "product_viewed",
    "added_to_cart",
    "purchased",
    "searched",
    "ad_impression",
    "ad_click",
    "ad_conversion",
    "reported",
    "hidden",
    "risk_outcome_labeled",
    "coin_transferred",
    "gift_sent",
    "saved",
)


class EventBatchRequest(ContractModel):
    events: list[dict[str, JsonValue]] = Field(min_length=1, max_length=MAXIMUM_EVENTS_PER_BATCH)


class RejectedEvent(ContractModel):
    index: int
    event_id: str | None
    reason: str


class EventBatchResponse(ContractModel):
    accepted: int
    duplicates: int
    rejected: list[RejectedEvent]


def describe_validation_failure_without_values(error_list: list[Any]) -> str:
    first_error = error_list[0] if error_list else {}
    location = ".".join(str(part) for part in first_error.get("loc", ()))
    return f"{first_error.get('type', 'invalid')} at {location or 'event'}"
