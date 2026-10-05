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
    ProductViewedDomainEvent,
    ReportCreatedDomainEvent,
)
from src.services.identifier_hashing_service import OpaqueIdentifierHasher

PERSONALIZATION_DOMAIN_EVENT_TYPES = frozenset(
    {
        "product.viewed",
        "follow.created",
        "ad.impressionRecorded",
        "post.liked",
        "post.shared",
        "comment.created",
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
UNHASHED_VALUE_FLOW_EVENT_TYPES = frozenset({"gift.sent"})
HASHED_PAYLOAD_USER_FIELDS = ("authorId", "creatorId", "targetAuthorId", "hostCreatorId")


def resolve_intelligence_event_type(event: DomainEvent) -> str | None:
    match event:
        case ProductViewedDomainEvent():
            return "product_viewed"
        case FollowCreatedDomainEvent():
            return "followed"
        case AdImpressionRecordedDomainEvent():
            return "ad_impression"
        case GiftSentDomainEvent():
            return "gift_sent"
        case ReportCreatedDomainEvent():
            return "reported"
        case PostLikedDomainEvent():
            return "post_liked"
        case PostSharedDomainEvent():
            return "shared"
        case CommentCreatedDomainEvent() if event.payload.author_id is not None:
            return "commented"
        case ContentSavedDomainEvent():
            return "saved"
        case PostViewedDomainEvent():
            return "post_viewed"
        case ClipWatchedDomainEvent():
            return "clip_watched"
        case _:
            return None


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
    payload = event.payload.model_dump(by_alias=True, mode="json", exclude_none=True)
    keep_raw = event.event_type in UNHASHED_VALUE_FLOW_EVENT_TYPES
    envelope: dict[str, Any] = {
        "eventId": event.event_id,
        "eventType": intelligence_type,
        "occurredAt": event.occurred_at.isoformat(),
        "actorId": event.actor_id if keep_raw else hasher.hash_user_id(event.actor_id),
        "producer": "domain_events",
        "payload": payload if keep_raw else pseudonymize_payload(payload, hasher),
    }
    if event.country:
        envelope["country"] = event.country
    return envelope
