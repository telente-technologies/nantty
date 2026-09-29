import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from src.container import ApplicationContainer
from src.integrations.dataset_storage_integration import build_local_dataset_storage_location
from src.modules.events_ingestion.services.event_ingestion_service import EventStorageUnavailableError
from src.modules.trending.dtos.trending_dto import TrendingRequest
from src.modules.trending.services.trending_service import TrendingSignal, calculate_trending_score
from src.repositories.online_feature_keyspace_repository import AFFINITY_HALF_LIFE_SECONDS, TOPIC_AFFINITY_KIND
from src.utils.dataset_loading_util import load_raw_events
from src.utils.decay_math_util import (
    calculate_forward_decay_read_multiplier,
    calculate_forward_decay_write_weight,
    find_forward_decay_generation,
)
from tests.conftest import SignedIntelligenceClient, build_event


def build_like(
    event_id: str, actor_id: str, occurred_at: datetime, post_id: str = "post_1", **extra: Any
) -> dict[str, Any]:
    payload = {"postId": post_id, "authorId": "author_1", "topics": ["fashion"], "hashtags": ["ankara"]}
    return build_event(event_id, "post_liked", actor_id, occurred_at, payload, country="NG", **extra)


async def test_event_batch_is_idempotent_and_partially_accepted(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    events = [build_like(f"evt_{index}", f"user_{index}", reference_now) for index in range(5)]
    events.append(
        {
            "eventId": "evt_bad",
            "eventType": "post_liked",
            "occurredAt": reference_now.isoformat(),
            "actorId": "user_x",
            "payload": {},
        }
    )
    events.append(build_like("evt_future", "user_y", reference_now + timedelta(hours=1)))
    events.append({"eventType": "unknown_type"})
    events.append(build_like("evt_0", "user_0", reference_now))
    first = (await signed_client.post("/v1/events", {"events": events})).json()
    assert first["accepted"] == 5
    assert first["duplicates"] == 1
    assert {rejected["index"]: rejected["reason"] for rejected in first["rejected"]}[6] == "occurred_at_in_future"
    assert {rejected["eventId"] for rejected in first["rejected"]} == {"evt_bad", "evt_future", None}
    assert all("user_x" not in rejected["reason"] for rejected in first["rejected"])
    second = (await signed_client.post("/v1/events", {"events": events[:5]})).json()
    assert second == {"accepted": 0, "duplicates": 5, "rejected": []}


async def test_accepted_events_land_in_partitioned_parquet(
    application_container: ApplicationContainer, reference_now: datetime, tmp_path: Path
) -> None:
    await application_container.event_ingestion_service.ingest_event_batch(
        [build_like(f"evt_{index}", f"user_{index}", reference_now) for index in range(3)]
    )
    partition = (
        tmp_path / "data" / "raw_events" / "event_type=post_liked" / f"event_date={reference_now.strftime('%Y-%m-%d')}"
    )
    assert any(partition.glob("part-*.parquet"))
    stored = load_raw_events(build_local_dataset_storage_location(str(tmp_path / "data")), ["post_liked"])
    assert sorted(stored.get_column("event_id").to_list()) == ["evt_0", "evt_1", "evt_2"]
    assert '"postId":"post_1"' in stored.get_column("payload_json").to_list()[0]


async def test_storage_failure_releases_claims_so_retry_succeeds(
    application_container: ApplicationContainer, reference_now: datetime, monkeypatch: pytest.MonkeyPatch
) -> None:
    service = application_container.event_ingestion_service

    def fail_write(*_arguments: object) -> int:
        raise OSError("disk full")

    monkeypatch.setattr(service.raw_event_sink, "write_events_synchronously", fail_write)
    with pytest.raises(EventStorageUnavailableError):
        await service.ingest_event_batch([build_like("evt_retry", "user_1", reference_now)])
    monkeypatch.undo()
    retried = await service.ingest_event_batch([build_like("evt_retry", "user_1", reference_now)])
    assert retried.accepted == 1


async def test_engagement_updates_decayed_topic_affinity(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    await application_container.event_ingestion_service.ingest_event_batch(
        [build_like("evt_aff", "user_1", reference_now - timedelta(days=14))]
    )
    store = application_container.feature_store
    scores = await store.read_decayed_member_scores(
        store.keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, "user_1"),
        ["fashion", "ankara"],
        AFFINITY_HALF_LIFE_SECONDS,
        reference_now.timestamp(),
    )
    assert scores["fashion"] == pytest.approx(0.5, rel=1e-3)
    assert scores["ankara"] == pytest.approx(0.5, rel=1e-3)


def test_forward_decay_matches_direct_exponential_across_generations() -> None:
    half_life_seconds = 6 * 3600.0
    generation = find_forward_decay_generation(1_800_000_000, half_life_seconds)
    event_time = generation.epoch_seconds - 3600
    read_time = generation.epoch_seconds + 7200
    written_generation, stored_weight = calculate_forward_decay_write_weight(2.0, event_time, half_life_seconds)
    assert written_generation == generation.generation_index - 1
    decayed = stored_weight * calculate_forward_decay_read_multiplier(written_generation, read_time, half_life_seconds)
    assert decayed == pytest.approx(2.0 * math.pow(0.5, (read_time - event_time) / half_life_seconds))


def test_trending_score_needs_distinct_actors_and_penalises_reports() -> None:
    healthy = TrendingSignal("tag", 30.0, 60.0, 12, 0.0)
    assert calculate_trending_score(TrendingSignal("tag", 30.0, 60.0, 3, 0.0), 5) is None
    healthy_score = calculate_trending_score(healthy, 5)
    reported_score = calculate_trending_score(TrendingSignal("tag", 30.0, 60.0, 12, 0.08), 5)
    steady_score = calculate_trending_score(TrendingSignal("tag", 30.0, 3000.0, 12, 0.0), 5)
    assert healthy_score is not None
    assert reported_score is not None
    assert steady_score is not None
    assert reported_score[0] < healthy_score[0]
    assert steady_score[1] < healthy_score[1]


async def test_single_actor_spamming_cannot_create_a_trend(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    spam = [
        build_like(f"spam_{index}", "spammer", reference_now - timedelta(seconds=index), post_id=f"post_{index}")
        for index in range(200)
    ]
    organic_payload = {"postId": "post_organic", "authorId": "author_2", "hashtags": ["afrobeats"]}
    organic = [
        build_event(f"org_{index}", "post_liked", f"fan_{index}", reference_now, organic_payload, country="NG")
        for index in range(8)
    ]
    await application_container.event_ingestion_service.ingest_event_batch(spam)
    await application_container.event_ingestion_service.ingest_event_batch(organic)
    trending = await application_container.trending_service.read_trending(
        TrendingRequest.model_validate(
            {"kind": "hashtag", "country": "NG", "minimumDistinctActors": 5, "now": reference_now.isoformat()}
        )
    )
    assert [item.item_id for item in trending.items] == ["afrobeats"]
    assert trending.items[0].distinct_actors == 8


async def test_repeat_engagement_by_same_actor_counts_once_per_hour(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    store = application_container.feature_store
    repeated = [build_like(f"rep_{index}", "fan_1", reference_now) for index in range(20)]
    await application_container.event_ingestion_service.ingest_event_batch(repeated)
    rows = await store.read_decayed_highest_members(
        store.keyspace.trending_base_key("post", "global", "short"), 5, 6 * 3600, reference_now.timestamp()
    )
    assert rows[0][0] == "post_1"
    assert rows[0][1] == pytest.approx(1.0, rel=0.01)
