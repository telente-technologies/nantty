from typing import Any

from src.events.domain_event_dto import (
    AdImpressionRecordedDomainEvent,
    DomainEvent,
    FollowCreatedDomainEvent,
    GiftSentDomainEvent,
    ProductViewedDomainEvent,
    ReportCreatedDomainEvent,
)

PERSONALIZATION_DOMAIN_EVENT_TYPES = frozenset({"product.viewed", "follow.created", "ad.impressionRecorded"})
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


def translate_to_intelligence_event(event: DomainEvent, personalization_allowed: bool) -> dict[str, Any] | None:
    match event:
        case ProductViewedDomainEvent():
            intelligence_type = "product_viewed"
        case FollowCreatedDomainEvent():
            intelligence_type = "followed"
        case AdImpressionRecordedDomainEvent():
            intelligence_type = "ad_impression"
        case GiftSentDomainEvent():
            intelligence_type = "gift_sent"
        case ReportCreatedDomainEvent():
            intelligence_type = "reported"
        case _:
            return None
    if not personalization_allowed and event.event_type != "gift.sent":
        return None
    envelope: dict[str, Any] = {
        "eventId": event.event_id,
        "eventType": intelligence_type,
        "occurredAt": event.occurred_at.isoformat(),
        "actorId": event.actor_id,
        "producer": "domain_events",
        "payload": event.payload.model_dump(by_alias=True, mode="json", exclude_none=True),
    }
    if event.country:
        envelope["country"] = event.country
    return envelope
