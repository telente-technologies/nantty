import json
from datetime import UTC, datetime
from typing import Any

import pytest

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.interfaces.feature_backend_interface import SortedSetAssignScore
from src.repositories.online_feature_keyspace_repository import (
    AFFINITY_HALF_LIFE_SECONDS,
    ITEM_AFFINITY_KIND,
    format_utc_day_bucket,
)
from src.utils.decay_math_util import HALF_LIVES_PER_FORWARD_DECAY_GENERATION, FORWARD_DECAY_BASE_EPOCH_SECONDS, find_forward_decay_generation
from tests.modules.domain_events.helpers import domain_event, hashed, product_viewed, read_topic_affinity


async def test_opted_out_user_gets_no_personalization_features(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(
        domain_event("evt_pv_a_consent", "consent.granted", "user_2", reference_now, {"consentType": "personalization"})
    )
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
    await application_container.domain_event_consumer_service.purge_service.record_personalization_choice(
        viewer_id, True
    )
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


async def test_contract_envelope_shape_and_deletion_request_stops_personalization(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(
        domain_event(
            "evt_env_pv_consent", "consent.granted", "user_5", reference_now, {"consentType": "personalization"}
        )
    )
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
