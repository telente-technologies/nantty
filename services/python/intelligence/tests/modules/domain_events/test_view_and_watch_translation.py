import json
from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.domain_event_dto import (
    ClipWatchedDomainEvent,
    PostViewedDomainEvent,
    ProductViewedDomainEvent,
    domain_event_type_adapter,
)


def envelope(event_type: str, data: dict[str, Any], occurred_at: datetime, event_id: str = "evt_1") -> dict[str, Any]:
    return {
        "id": event_id,
        "type": event_type,
        "source": "social",
        "subject": "subject_1",
        "schemaVersion": 1,
        "occurredAt": occurred_at.isoformat(),
        "data": data,
    }


def social_base(**extra: Any) -> dict[str, Any]:
    return {
        "actorId": "viewer_1",
        "postId": "post_1",
        "postAuthorId": "author_1",
        "authorId": "author_1",
        "kind": "clip",
        "topics": ["fashion"],
        "hashtags": ["summer", "ankara", "ọjà"],
        "surface": "clips",
        "rankingRequestId": None,
        **extra,
    }


def test_social_post_viewed_shape_validates(reference_now: datetime) -> None:
    body = normalize_contract_envelope(
        envelope("post.viewed", social_base(dwellMs=4200, position=None, isProductPost=False), reference_now)
    )
    event = domain_event_type_adapter.validate_python(body)
    assert isinstance(event, PostViewedDomainEvent)
    assert event.actor_id == "viewer_1"
    assert event.payload.author_id == "author_1"
    assert event.payload.dwell_ms == 4200
    assert event.payload.hashtags == ["summer", "ankara"]


def test_social_clip_watched_shape_validates(reference_now: datetime) -> None:
    data = social_base(watchFraction=0.75, loopCount=2, durationMs=15000, watchMs=40000)
    event = domain_event_type_adapter.validate_python(
        normalize_contract_envelope(envelope("clip.watched", data, reference_now))
    )
    assert isinstance(event, ClipWatchedDomainEvent)
    assert (event.payload.clip_id, event.payload.creator_id, event.payload.loop_count) == ("post_1", "author_1", 2)


def test_commerce_product_viewed_is_no_longer_dropped(reference_now: datetime) -> None:
    data = {
        "occurredAt": reference_now.isoformat(),
        "productId": "product_1",
        "storeId": "store_1",
        "surface": "feed",
        "personalized": True,
        "actorId": "shopper_1",
    }
    event = domain_event_type_adapter.validate_python(
        normalize_contract_envelope(envelope("product.viewed", data, reference_now))
    )
    assert isinstance(event, ProductViewedDomainEvent)
    assert (event.actor_id, event.payload.product_id, event.payload.store_id) == ("shopper_1", "product_1", "store_1")


async def test_social_view_and_watch_reach_item_statistics(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    view = envelope("post.viewed", social_base(dwellMs=9000, position=3, isProductPost=False), reference_now, "evt_v")
    watch = envelope(
        "clip.watched",
        social_base(watchFraction=1.0, loopCount=1, durationMs=9000, watchMs=18000),
        reference_now,
        "evt_w",
    )
    assert (await consumer.process_message_body(json.dumps(view))).status == "processed"
    assert (await consumer.process_message_body(json.dumps(watch))).status == "processed"


async def test_unpersonalised_product_view_is_skipped_not_dead_lettered(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    data = {
        "occurredAt": reference_now.isoformat(),
        "productId": "product_1",
        "storeId": "store_1",
        "personalized": False,
    }
    body = json.dumps(envelope("product.viewed", data, reference_now, "evt_pv"))
    assert (
        await application_container.domain_event_consumer_service.process_message_body(body)
    ).status == "skipped_unattributed"
