from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, TypeAdapter

from src.dtos.common_dto import ContractModel
from src.events.event_payload_dto import (
    AdImpressionPayload,
    ClipWatchedPayload,
    FollowedPayload,
    GiftSentPayload,
    ItemTopicsMixin,
    PostLikedPayload,
    PostViewedPayload,
    ProductViewedPayload,
    PurchasedPayload,
    ReportedPayload,
    SavedPayload,
    SharedPayload,
)
from src.validators.common_field_validator import CountryCode, OpaqueIdentifier


class DomainEnvelopeBase(ContractModel):
    event_id: OpaqueIdentifier
    occurred_at: AwareDatetime
    actor_id: OpaqueIdentifier
    country: CountryCode | None = None


class MessageMetadataPayload(ContractModel):
    recipient_id: OpaqueIdentifier
    conversation_id: OpaqueIdentifier
    contains_link: bool = False
    link_reported: bool = False
    device_id: OpaqueIdentifier | None = None
    ip_hash: OpaqueIdentifier | None = None


class PostCreatedPayload(ContractModel):
    post_id: OpaqueIdentifier
    kind: Literal["post", "clip", "story"] = "post"
    text: str = Field(default="", max_length=5000)
    media_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=20)


class MediaProcessedPayload(ContractModel):
    media_id: OpaqueIdentifier
    purpose: str | None = Field(default=None, max_length=40)
    kind: str | None = Field(default=None, max_length=20)
    image_key: str | None = Field(default=None, max_length=1024)


class BlockCreatedPayload(ContractModel):
    blocked_account_id: OpaqueIdentifier


class LoginPayload(ContractModel):
    device_id: OpaqueIdentifier | None = None
    ip_hash: OpaqueIdentifier | None = None


class ConsentChangePayload(ContractModel):
    consent_type: Literal["analytics", "personalization", "advertising", "marketing"]


class CommentCreatedPayload(ItemTopicsMixin):
    post_id: OpaqueIdentifier
    author_id: OpaqueIdentifier | None = None
    comment_id: OpaqueIdentifier | None = None


class CommentVisibilityPayload(ContractModel):
    comment_id: OpaqueIdentifier
    post_id: OpaqueIdentifier
    post_author_id: OpaqueIdentifier


class EmptyPayload(ContractModel):
    pass


class ProductViewedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["product.viewed"]
    payload: ProductViewedPayload


class ProductPurchasedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["product.purchased"]
    payload: PurchasedPayload


class FollowCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["follow.created"]
    payload: FollowedPayload


class PostCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["post.created"]
    payload: PostCreatedPayload


class MediaProcessedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["media.processed"]
    payload: MediaProcessedPayload


class GiftSentDomainEvent(DomainEnvelopeBase):
    event_type: Literal["gift.sent"]
    payload: GiftSentPayload


class MessageSentDomainEvent(DomainEnvelopeBase):
    event_type: Literal["message.sent"]
    payload: MessageMetadataPayload


class ReportCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["report.created"]
    payload: ReportedPayload


class BlockCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["block.created"]
    payload: BlockCreatedPayload


class AdImpressionRecordedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["ad.impressionRecorded"]
    payload: AdImpressionPayload


class LoggedInDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.loggedIn"]
    payload: LoginPayload


class AccountRegisteredDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.registered"]
    payload: EmptyPayload


class ConsentGrantedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["consent.granted"]
    payload: ConsentChangePayload


class ConsentWithdrawnDomainEvent(DomainEnvelopeBase):
    event_type: Literal["consent.withdrawn"]
    payload: ConsentChangePayload


class AccountDeletionRequestedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.deletionRequested"]
    payload: EmptyPayload


class AccountDeletionExecutedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["account.deletionExecuted"]
    payload: EmptyPayload


class PostLikedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["post.liked"]
    payload: PostLikedPayload


class PostSharedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["post.shared"]
    payload: SharedPayload


class CommentCreatedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["comment.created"]
    payload: CommentCreatedPayload


class CommentHiddenDomainEvent(DomainEnvelopeBase):
    event_type: Literal["comment.hidden"]
    payload: CommentVisibilityPayload


class CommentUnhiddenDomainEvent(DomainEnvelopeBase):
    event_type: Literal["comment.unhidden"]
    payload: CommentVisibilityPayload


class ContentSavedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["content.saved"]
    payload: SavedPayload


class PostViewedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["post.viewed"]
    payload: PostViewedPayload


class ClipWatchedDomainEvent(DomainEnvelopeBase):
    event_type: Literal["clip.watched"]
    payload: ClipWatchedPayload


type DomainEvent = Annotated[
    ProductViewedDomainEvent
    | ProductPurchasedDomainEvent
    | FollowCreatedDomainEvent
    | PostCreatedDomainEvent
    | MediaProcessedDomainEvent
    | GiftSentDomainEvent
    | MessageSentDomainEvent
    | ReportCreatedDomainEvent
    | BlockCreatedDomainEvent
    | AdImpressionRecordedDomainEvent
    | LoggedInDomainEvent
    | AccountRegisteredDomainEvent
    | ConsentGrantedDomainEvent
    | ConsentWithdrawnDomainEvent
    | AccountDeletionRequestedDomainEvent
    | AccountDeletionExecutedDomainEvent
    | PostLikedDomainEvent
    | PostSharedDomainEvent
    | CommentCreatedDomainEvent
    | CommentHiddenDomainEvent
    | CommentUnhiddenDomainEvent
    | ContentSavedDomainEvent
    | PostViewedDomainEvent
    | ClipWatchedDomainEvent,
    Field(discriminator="event_type"),
]

domain_event_type_adapter: TypeAdapter[DomainEvent] = TypeAdapter(DomainEvent)
