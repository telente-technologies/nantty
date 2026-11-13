from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.interfaces.feature_backend_interface import HashFieldAssign
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_DELETED_FIELD,
    PERSONALIZATION_OPT_OUT_FIELD,
    OnlineFeatureKeyspace,
)


async def test_opted_out_recommendation_does_not_read_per_viewer_features(
    application_container: ApplicationContainer,
    reference_now: datetime,
    monkeypatch: Any,
) -> None:
    feature_store = application_container.feature_store
    keyspace: OnlineFeatureKeyspace = feature_store.keyspace
    viewer_id = "viewer_opted_out"
    await feature_store.feature_backend.apply_write_operations(
        [
            HashFieldAssign(keyspace.consent_key(viewer_id), PERSONALIZATION_OPT_OUT_FIELD, 1.0),
        ]
    )
    affinity_reads: list[tuple[str, list[str]]] = []
    original_read = feature_store.feature_backend.read_sorted_set_member_scores

    async def record_affinity_reads(
        requests: list[tuple[str, list[str]]],
    ) -> list[list[float | None]]:
        affinity_reads.extend(requests)
        return await original_read(requests)

    monkeypatch.setattr(feature_store.feature_backend, "read_sorted_set_member_scores", record_affinity_reads)
    seen_item_reads: list[str] = []
    original_seen_read = feature_store.feature_backend.read_sorted_set_highest_members

    async def record_seen_item_reads(keys: list[str], limit: int) -> list[list[tuple[str, float]]]:
        seen_item_reads.extend(keys)
        return await original_seen_read(keys, limit)

    monkeypatch.setattr(feature_store.feature_backend, "read_sorted_set_highest_members", record_seen_item_reads)

    features = await feature_store.read_viewer_online_features(
        viewer_id,
        account_ids=["store_1"],
        topic_ids=["fashion"],
        item_ids=["product_1"],
        now=reference_now,
    )

    assert affinity_reads == []
    assert seen_item_reads == []
    assert features.account_affinity_by_account == {}
    assert features.topic_affinity_by_topic == {}
    assert features.item_affinity_by_item == {}


async def test_missing_personalization_consent_fails_closed(
    application_container: ApplicationContainer,
) -> None:
    feature_store = application_container.feature_store

    assert not await feature_store.is_personalization_allowed("viewer_without_consent")


async def test_explicit_personalization_grant_allows_features(
    application_container: ApplicationContainer,
) -> None:
    feature_store = application_container.feature_store
    keyspace: OnlineFeatureKeyspace = feature_store.keyspace
    await feature_store.feature_backend.apply_write_operations(
        [HashFieldAssign(keyspace.consent_key("viewer_consented"), PERSONALIZATION_OPT_OUT_FIELD, 0.0)]
    )

    assert await feature_store.is_personalization_allowed("viewer_consented")


async def test_deleted_account_never_personalizes_even_with_explicit_grant(
    application_container: ApplicationContainer,
) -> None:
    feature_store = application_container.feature_store
    keyspace: OnlineFeatureKeyspace = feature_store.keyspace
    await feature_store.feature_backend.apply_write_operations(
        [
            HashFieldAssign(keyspace.consent_key("deleted_viewer"), PERSONALIZATION_OPT_OUT_FIELD, 0.0),
            HashFieldAssign(keyspace.consent_key("deleted_viewer"), ACCOUNT_DELETED_FIELD, 1.0),
        ]
    )

    assert not await feature_store.is_personalization_allowed("deleted_viewer")
