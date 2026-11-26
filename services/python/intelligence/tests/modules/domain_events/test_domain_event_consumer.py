import asyncio
import json
from datetime import datetime
from typing import Any
from unittest.mock import patch

import pytest

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import SqsDomainEventQueuePoller
from src.repositories.online_feature_keyspace_repository import format_utc_day_bucket
from tests.modules.domain_events.helpers import domain_event, product_viewed, read_topic_affinity

__all__ = ["domain_event", "product_viewed", "read_topic_affinity"]


async def test_consumer_is_idempotent_by_event_id(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    body = domain_event("evt_post_1", "post.created", "author_1", reference_now, {"postId": "post_1"})
    first = await consumer.process_message_body(body)
    second = await consumer.process_message_body(body)
    assert (first.status, second.status) == ("processed", "duplicate")
    keyspace = application_container.feature_store.keyspace
    counters = await feature_backend.read_hash_fields(
        [keyspace.behaviour_counter_key("author_1", format_utc_day_bucket(reference_now))]
    )
    assert counters[0]["posts_created"] == 1.0


async def test_product_view_updates_affinity_and_is_idempotent(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(
        domain_event("evt_pv_1_consent", "consent.granted", "user_1", reference_now, {"consentType": "personalization"})
    )
    await consumer.process_message_body(product_viewed("evt_pv_1", "user_1", reference_now))
    await consumer.process_message_body(product_viewed("evt_pv_1", "user_1", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_1") == 1
    keyspace = application_container.feature_store.keyspace
    statistics = await feature_backend.read_hash_fields([keyspace.item_statistics_key("p1")])
    assert statistics[0]["product_views"] == 1.0


async def test_message_metadata_event_rejects_any_content_field(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    metadata = {"recipientId": "r1", "conversationId": "c1", "containsLink": True}
    outcome = await consumer.process_message_body(
        domain_event("evt_msg_bad", "message.sent", "sender_1", reference_now, {**metadata, "text": "buy now"})
    )
    assert outcome.status == "rejected"
    keyspace = application_container.feature_store.keyspace
    day = format_utc_day_bucket(reference_now)
    assert (await feature_backend.read_hash_fields([keyspace.behaviour_counter_key("sender_1", day)]))[0] == {}
    ok = await consumer.process_message_body(
        domain_event("evt_msg_ok", "message.sent", "sender_1", reference_now, metadata)
    )
    assert ok.status == "processed"
    counters = (await feature_backend.read_hash_fields([keyspace.behaviour_counter_key("sender_1", day)]))[0]
    assert counters == {"messages_sent": 1.0, "links_sent": 1.0}


async def test_sns_wrapped_and_garbage_bodies(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    inner = domain_event("evt_wrapped", "post.created", "author_9", reference_now, {"postId": "p9"})
    assert (await consumer.process_message_body(json.dumps({"Message": inner}))).status == "processed"
    assert (await consumer.process_message_body("not json")).status == "rejected"
    assert (await consumer.process_message_body(json.dumps({"eventType": "unknown.thing"}))).status == "rejected"


class FakeSqsClient:
    def __init__(self, bodies: list[str]) -> None:
        self.messages = [{"Body": body, "ReceiptHandle": f"handle_{index}"} for index, body in enumerate(bodies)]
        self.deleted: list[str] = []

    def receive_message(self, **_kwargs: Any) -> dict[str, Any]:
        return {"Messages": self.messages}

    def delete_message(self, **kwargs: Any) -> dict[str, Any]:
        self.deleted.append(kwargs["ReceiptHandle"])
        return {}

    def send_message(self, **_kwargs: Any) -> dict[str, Any]:
        return {}


async def test_sqs_poller_acknowledges_processed_and_poison_messages(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    good = domain_event("evt_q1", "post.created", "author_q", reference_now, {"postId": "pq"})
    client = FakeSqsClient([good, "garbage"])
    poller = SqsDomainEventQueuePoller(client, "http://queue", application_container.domain_event_consumer_service, 0)
    assert await poller.poll_once() == 2
    assert client.deleted == ["handle_0", "handle_1"]


async def test_sqs_poller_keeps_message_when_processing_fails(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    async def explode(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("backend down")

    feature_backend.apply_write_operations = explode  # type: ignore[method-assign]
    body = domain_event("evt_q2", "post.created", "author_q2", reference_now, {"postId": "pq2"})
    client = FakeSqsClient([body])
    poller = SqsDomainEventQueuePoller(client, "http://queue", application_container.domain_event_consumer_service, 0)
    assert await poller.poll_once() == 0
    assert client.deleted == []
    del feature_backend.apply_write_operations
    assert (await application_container.domain_event_consumer_service.process_message_body(body)).status == "processed"


async def test_contract_post_created_and_media_processed_reach_content_scoring(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    post_created = json.dumps(
        {
            "id": "evt_contract_post",
            "type": "post.created",
            "source": "social",
            "subject": "post_9",
            "schemaVersion": 1,
            "occurredAt": reference_now.isoformat(),
            "data": {
                "postId": "post_9",
                "authorId": "author_9",
                "kind": "post",
                "audience": "everyone",
                "visibility": "public",
                "isAiGenerated": False,
                "text": "hello",
                "mediaIds": ["media_9"],
            },
        }
    )
    media_processed = json.dumps(
        {
            "id": "evt_contract_media",
            "type": "media.processed",
            "source": "media",
            "subject": "media_9",
            "schemaVersion": 1,
            "occurredAt": reference_now.isoformat(),
            "data": {
                "mediaId": "media_9",
                "ownerId": "author_9",
                "purpose": "post",
                "kind": "image",
                "status": "ready",
                "isPrivate": False,
                "width": 1,
                "height": 1,
                "variants": [],
            },
        }
    )
    assert (await consumer.process_message_body(post_created)).status == "processed"
    assert (await consumer.process_message_body(media_processed)).status == "processed"
    links = await application_container.feature_backend.read_sorted_set_highest_members(
        [application_container.feature_store.keyspace.media_post_link_key("media_9")], 1
    )
    assert links[0][0][0] == "post_9|author_9|post"


async def test_cancelled_processing_releases_the_claim_for_redelivery(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    body = product_viewed("evt_cancel_1", "author_cancel_1", reference_now)

    async def cancelled(_event: object) -> object:
        raise asyncio.CancelledError

    with patch.object(consumer, "apply_event", cancelled), pytest.raises(asyncio.CancelledError):
        await consumer.process_message_body(body)
    redelivery = await consumer.process_message_body(body)
    assert redelivery.status == "processed"
