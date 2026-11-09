import asyncio
import json
import time
from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch

import pytest

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.interfaces.feature_backend_interface import SortedSetAssignScore
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import SqsDomainEventQueuePoller
from src.repositories.online_feature_keyspace_repository import (
    AFFINITY_HALF_LIFE_SECONDS,
    ITEM_AFFINITY_KIND,
    TOPIC_AFFINITY_KIND,
    format_utc_day_bucket,
)
from src.utils.decay_math_util import (
    FORWARD_DECAY_BASE_EPOCH_SECONDS,
    HALF_LIVES_PER_FORWARD_DECAY_GENERATION,
    find_forward_decay_generation,
)


def domain_event(event_id: str, event_type: str, actor_id: str, occurred_at: datetime, payload: dict[str, Any]) -> str:
    return json.dumps(
        {
            "eventId": event_id,
            "eventType": event_type,
            "occurredAt": occurred_at.isoformat(),
            "actorId": actor_id,
            "payload": payload,
        }
    )


def product_viewed(event_id: str, actor_id: str, occurred_at: datetime) -> str:
    return domain_event(
        event_id, "product.viewed", actor_id, occurred_at, {"productId": "p1", "storeId": "s1", "topics": ["fashion"]}
    )


def hashed(container: ApplicationContainer, user_id: str) -> str:
    return container.domain_event_consumer_service.identifier_hasher.hash_user_id(user_id)


async def read_topic_affinity(backend: InMemoryFeatureBackend, container: ApplicationContainer, user_id: str) -> int:
    generation = find_forward_decay_generation(time.time(), AFFINITY_HALF_LIFE_SECONDS).generation_index
    base = container.feature_store.keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, hashed(container, user_id))
    rows = await backend.read_sorted_set_highest_members([f"{base}:g{generation}"], 10)
    return len(rows[0])


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
    await consumer.process_message_body(product_viewed("evt_pv_1", "user_1", reference_now))
    await consumer.process_message_body(product_viewed("evt_pv_1", "user_1", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_1") == 1
    keyspace = application_container.feature_store.keyspace
    statistics = await feature_backend.read_hash_fields([keyspace.item_statistics_key("p1")])
    assert statistics[0]["product_views"] == 1.0


async def test_opted_out_user_gets_no_personalization_features(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(product_viewed("evt_pv_a", "user_2", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_2") == 1
    await consumer.process_message_body(
        domain_event("evt_consent_1", "consent.withdrawn", "user_2", reference_now, {"consentType": "personalization"})
    )
    assert await read_topic_affinity(feature_backend, application_container, "user_2") == 0
    await consumer.process_message_body(product_viewed("evt_pv_b", "user_2", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_2") == 0
    store = application_container.feature_store
    viewer = hashed(application_container, "user_2")
    online = await store.read_viewer_online_features(viewer, [], ["fashion"], [], reference_now)
    assert online.topic_affinity_by_topic == {}
    assert await store.read_viewer_top_topic_affinities(viewer, 5, reference_now) == []


async def test_opt_back_in_resumes_personalization(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    for event_id, event_type in (("evt_c1", "consent.withdrawn"), ("evt_c2", "consent.granted")):
        await consumer.process_message_body(
            domain_event(event_id, event_type, "user_3", reference_now, {"consentType": "personalization"})
        )
    await consumer.process_message_body(product_viewed("evt_pv_c", "user_3", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_3") == 1


def future_affinity_generation() -> tuple[datetime, int]:
    generation_span = AFFINITY_HALF_LIFE_SECONDS * HALF_LIVES_PER_FORWARD_DECAY_GENERATION
    read_time = datetime.fromtimestamp(FORWARD_DECAY_BASE_EPOCH_SECONDS + 4 * generation_span, UTC)
    generation = find_forward_decay_generation(read_time.timestamp(), AFFINITY_HALF_LIFE_SECONDS).generation_index
    return read_time, generation


async def seed_item_affinity_generations(
    backend: InMemoryFeatureBackend, keyspace: Any, viewer_id: str, generation: int
) -> list[str]:
    base_key = keyspace.affinity_base_key(ITEM_AFFINITY_KIND, viewer_id)
    keys = [f"{base_key}:g{index}" for index in range(generation + 2)]
    await backend.apply_write_operations(
        [SortedSetAssignScore(key, "product_1", float(index + 1)) for index, key in enumerate(keys)]
    )
    return keys


async def test_opt_out_and_regrant_cannot_recall_any_item_affinity_generation(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    viewer_id = hashed(application_container, "item_opt_out_user")
    keyspace = application_container.feature_store.keyspace
    read_time, generation = future_affinity_generation()
    purge_timestamp = read_time.timestamp()
    monkeypatch.setattr(
        "src.modules.domain_events.services.personal_data_purge_service.time.time", lambda: purge_timestamp
    )
    keys = await seed_item_affinity_generations(feature_backend, keyspace, viewer_id, generation)
    store = application_container.feature_store
    recalled_before_purge = await store.read_viewer_top_item_affinities(viewer_id, 10, read_time)
    assert [product_id for product_id, _score in recalled_before_purge] == ["product_1"]

    purge_service = application_container.domain_event_consumer_service.purge_service
    await purge_service.record_personalization_choice(viewer_id, False)
    await purge_service.record_personalization_choice(viewer_id, True)

    assert await store.read_viewer_top_item_affinities(viewer_id, 10, read_time) == []
    assert await feature_backend.read_sorted_set_highest_members(keys, 10) == [[] for _ in keys]


async def test_account_purge_deletes_all_item_affinity_generations(
    application_container: ApplicationContainer,
    feature_backend: InMemoryFeatureBackend,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    viewer_id = hashed(application_container, "item_erasure_user")
    keyspace = application_container.feature_store.keyspace
    read_time, generation = future_affinity_generation()
    purge_timestamp = read_time.timestamp()
    monkeypatch.setattr(
        "src.modules.domain_events.services.personal_data_purge_service.time.time", lambda: purge_timestamp
    )
    keys = await seed_item_affinity_generations(feature_backend, keyspace, viewer_id, generation)

    await application_container.domain_event_consumer_service.purge_service.purge_account(viewer_id)

    assert await feature_backend.read_sorted_set_highest_members(keys, 10) == [[] for _ in keys]


async def test_account_deletion_purges_features_and_blocks_late_events(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    keyspace = application_container.feature_store.keyspace
    day = format_utc_day_bucket(reference_now)
    await consumer.process_message_body(product_viewed("evt_pv_d", "user_4", reference_now))
    await consumer.process_message_body(
        domain_event(
            "evt_login_d", "account.loggedIn", "user_4", reference_now, {"deviceId": "dev_1", "ipHash": "ip_1"}
        )
    )
    await consumer.process_message_body(
        domain_event("evt_del", "account.deletionExecuted", "user_4", reference_now, {})
    )
    assert await read_topic_affinity(feature_backend, application_container, "user_4") == 0
    counters = await feature_backend.read_hash_fields([keyspace.behaviour_counter_key("user_4", day)])
    assert counters[0] == {}
    assert await feature_backend.count_distinct_members(
        [keyspace.behaviour_distinct_key("devices", "user_4", day)]
    ) == [0]
    late = await consumer.process_message_body(product_viewed("evt_pv_late", "user_4", reference_now))
    assert late.status == "skipped_deleted_account"
    assert await read_topic_affinity(feature_backend, application_container, "user_4") == 0


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


async def test_contract_envelope_shape_and_deletion_request_stops_personalization(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(product_viewed("evt_env_pv", "user_5", reference_now))
    assert await read_topic_affinity(feature_backend, application_container, "user_5") == 1
    envelope = {
        "id": "3f2b8c1e-0000-4000-8000-000000000001",
        "type": "account.deletionRequested",
        "source": "goIdentity",
        "subject": "user_5",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {
            "accountId": "user_5",
            "requestedAt": reference_now.isoformat(),
            "scheduledFor": reference_now.isoformat(),
            "retentionPolicy": [],
        },
    }
    assert (await consumer.process_message_body(json.dumps(envelope))).status == "processed"
    assert await read_topic_affinity(feature_backend, application_container, "user_5") == 0
    assert not await application_container.feature_store.is_personalization_allowed("user_5")
    assert not await application_container.feature_store.is_personalization_allowed(
        hashed(application_container, "user_5")
    )


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
