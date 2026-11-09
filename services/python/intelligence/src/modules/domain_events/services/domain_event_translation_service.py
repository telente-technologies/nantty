from typing import Any

from src.events.domain_event_dto import (
    AdImpressionRecordedDomainEvent,
    ClipWatchedDomainEvent,
    CommentCreatedDomainEvent,
    ContentSavedDomainEvent,
    DomainEvent,
    FollowCreatedDomainEvent,
    GiftSentDomainEvent,
    PostLikedDomainEvent,
    PostSharedDomainEvent,
    PostViewedDomainEvent,
    ProductAddedToCartDomainEvent,
    ProductClickedDomainEvent,
    ProductPurchasedDomainEvent,
    ProductViewedDomainEvent,
    ReportCreatedDomainEvent,
    SearchPerformedDomainEvent,
    StoreFollowedDomainEvent,
)
from src.services.identifier_hashing_service import OpaqueIdentifierHasher

PERSONALIZATION_DOMAIN_EVENT_TYPES = frozenset(
    {
        "product.viewed",
        "product.clicked",
        "product.addedToCart",
        "search.performed",
        "product.purchased",
        "follow.created",
        "store.followed",
        "ad.impressionRecorded",
        "post.liked",
        "post.shared",
        "comment.created",
        "comment.hidden",
        "comment.unhidden",
        "content.saved",
        "post.viewed",
        "clip.watched",
    }
)
SAFETY_DOMAIN_EVENT_TYPES = frozenset(
    {
        "gift.sent",
        "report.created",
        "message.sent",
        "block.created",
        "account.loggedIn",
        "post.created",
        "account.registered",
    }
)
HASHED_PAYLOAD_USER_FIELDS = ("authorId", "creatorId", "targetAuthorId", "hostCreatorId")
DOMAIN_ONLY_PAYLOAD_FIELDS = {"comment_id"}


def resolve_intelligence_event_type(event: DomainEvent) -> str | None:
    event_type: str | None
    match event:
        case ProductViewedDomainEvent():
            event_type = "product_viewed"
        case ProductClickedDomainEvent() if event.payload.query_hash:
            event_type = "searched"
        case ProductClickedDomainEvent():
            event_type = "product_viewed"
        case ProductAddedToCartDomainEvent():
            event_type = "added_to_cart"
        case SearchPerformedDomainEvent():
            event_type = "searched"
        case ProductPurchasedDomainEvent():
            event_type = "purchased"
        case FollowCreatedDomainEvent() | StoreFollowedDomainEvent():
            event_type = "followed"
        case AdImpressionRecordedDomainEvent():
            event_type = "ad_impression"
        case GiftSentDomainEvent():
            event_type = "gift_sent"
        case ReportCreatedDomainEvent():
            event_type = "reported"
        case PostLikedDomainEvent():
            event_type = "post_liked"
        case PostSharedDomainEvent():
            event_type = "shared"
        case CommentCreatedDomainEvent() if event.payload.author_id is not None:
            event_type = "commented"
        case ContentSavedDomainEvent():
            event_type = "saved"
        case PostViewedDomainEvent():
            event_type = "post_viewed"
        case ClipWatchedDomainEvent():
            event_type = "clip_watched"
        case _:
            event_type = None
    return event_type


def pseudonymize_payload(payload: dict[str, Any], hasher: OpaqueIdentifierHasher) -> dict[str, Any]:
    hashed = dict(payload)
    for field in HASHED_PAYLOAD_USER_FIELDS:
        if isinstance(hashed.get(field), str):
            hashed[field] = hasher.hash_user_id(hashed[field])
    if hashed.get("targetKind") == "user" and isinstance(hashed.get("targetAccountId"), str):
        hashed["targetAccountId"] = hasher.hash_user_id(hashed["targetAccountId"])
    return hashed


def translate_to_intelligence_event(
    event: DomainEvent, personalization_allowed: bool, hasher: OpaqueIdentifierHasher
) -> dict[str, Any] | None:
    intelligence_type = resolve_intelligence_event_type(event)
    if intelligence_type is None:
        return None
    if not personalization_allowed and event.event_type != "gift.sent":
        return None
    payload = event.payload.model_dump(
        by_alias=True, mode="json", exclude_none=True, exclude=DOMAIN_ONLY_PAYLOAD_FIELDS
    )
    if isinstance(event, ProductClickedDomainEvent):
        if event.payload.query_hash:
            payload = {
                "queryHash": event.payload.query_hash,
                "resultCount": event.payload.result_count,
                "clickedItemId": event.payload.product_id,
                "clickedItemType": "product",
            }
        else:
            payload = {
                "productId": event.payload.product_id,
                "storeId": event.payload.store_id,
                **({"categoryId": event.payload.category_id} if event.payload.category_id else {}),
            }
    if event.event_type == "gift.sent":
        # Value-flow scoring needs only a stable pseudonymous counterparty and amount.
        payload = {
            "creatorId": hasher.hash_user_id(event.payload.creator_id),
            "coinAmount": event.payload.coin_amount,
        }
    envelope: dict[str, Any] = {
        "eventId": event.event_id,
        "eventType": intelligence_type,
        "occurredAt": event.occurred_at.isoformat(),
        "actorId": hasher.hash_user_id(event.actor_id),
        "producer": "domain_events",
        "payload": payload if event.event_type == "gift.sent" else pseudonymize_payload(payload, hasher),
    }
    if event.country and event.event_type != "gift.sent":
        envelope["country"] = event.country
    return envelope
