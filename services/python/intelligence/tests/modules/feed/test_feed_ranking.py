from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest, FeedRankingResponse
from tests.conftest import build_event, build_viewer


def build_feed_candidates(now: datetime, count: int, author_count: int = 3) -> list[dict[str, Any]]:
    return [
        {
            "itemId": f"post_{index:03d}",
            "authorId": f"author_{index % author_count}",
            "storeId": f"store_{index % 2}" if index % 3 == 0 else None,
            "contentKind": "product" if index % 3 == 0 else "personal",
            "createdAt": (now - timedelta(hours=index % 30)).isoformat(),
            "topics": ["fashion" if index % 2 else "food"],
            "likeCount": (index * 7) % 50,
            "viewCount": 200,
        }
        for index in range(count)
    ]


async def rank_feed(container: ApplicationContainer, payload: dict[str, Any]) -> FeedRankingResponse:
    return await container.feed_ranking_service.rank_feed(FeedRankingRequest.model_validate(payload))


def find_author_run_lengths(item_ids: Sequence[str], author_by_item: dict[str, str]) -> list[int]:
    run_lengths: list[int] = []
    for position, item_id in enumerate(item_ids):
        if position and author_by_item[item_ids[position - 1]] == author_by_item[item_id]:
            run_lengths[-1] += 1
        else:
            run_lengths.append(1)
    return run_lengths


async def test_ranking_is_deterministic_for_identical_requests(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    payload = {
        "requestId": "req_1",
        "viewer": build_viewer(),
        "candidates": build_feed_candidates(reference_now, 60),
        "now": reference_now.isoformat(),
    }
    first = await rank_feed(application_container, payload)
    second = await rank_feed(application_container, payload)
    assert [item.item_id for item in first.items] == [item.item_id for item in second.items]
    assert [item.score for item in first.items] == [item.score for item in second.items]


async def test_diversity_rules_hold_when_feasible(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = build_feed_candidates(reference_now, 90, author_count=6)
    response = await rank_feed(
        application_container,
        {"viewer": build_viewer(), "candidates": candidates, "limit": 30, "now": reference_now.isoformat()},
    )
    item_ids = [item.item_id for item in response.items]
    author_by_item = {candidate["itemId"]: candidate["authorId"] for candidate in candidates}
    product_items = {candidate["itemId"] for candidate in candidates if candidate["contentKind"] == "product"}
    assert len(item_ids) == 30
    assert max(find_author_run_lengths(item_ids, author_by_item)) == 1
    product_flags = [item_id in product_items for item_id in item_ids]
    longest_product_run = max(
        (len(run) for run in "".join("p" if flag else "-" for flag in product_flags).split("-")), default=0
    )
    assert longest_product_run <= 2
    assert sum(product_flags) / len(product_flags) <= 0.45


async def test_blocked_muted_hidden_and_seen_items_are_excluded(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    await application_container.domain_event_consumer_service.purge_service.record_personalization_choice(
        "viewer_1", True
    )
    await application_container.event_ingestion_service.ingest_event_batch(
        [
            build_event(
                "seen_evt",
                "post_viewed",
                "viewer_1",
                reference_now - timedelta(minutes=5),
                {"postId": "post_004", "authorId": "author_1", "dwellMs": 1200},
            )
        ]
    )
    viewer = build_viewer(
        blockedAccountIds=["author_0"],
        mutedAccountIds=["store_1"],
        hiddenItemIds=["post_002"],
        seenItemIds=["post_005"],
    )
    candidates = build_feed_candidates(reference_now, 12)
    candidates.append(dict(candidates[1]))
    response = await rank_feed(
        application_container,
        {"viewer": viewer, "candidates": candidates, "limit": 50, "now": reference_now.isoformat()},
    )
    returned = {item.item_id for item in response.items}
    reasons = {excluded.item_id: excluded.reason for excluded in response.excluded}
    assert not any(candidate["authorId"] == "author_0" and candidate["itemId"] in returned for candidate in candidates)
    assert not any(candidate["storeId"] == "store_1" and candidate["itemId"] in returned for candidate in candidates)
    assert reasons["post_002"] == "hidden_by_viewer"
    assert reasons["post_004"] == "already_seen"
    assert reasons["post_005"] == "already_seen"
    assert len(returned) == len(response.items)


async def test_creator_affinity_learned_from_events_lifts_that_creator(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    await application_container.domain_event_consumer_service.purge_service.record_personalization_choice(
        "viewer_1", True
    )
    candidates = [
        {
            "itemId": f"post_{author}",
            "authorId": author,
            "createdAt": reference_now.isoformat(),
            "topics": ["music"],
            "viewCount": 10,
        }
        for author in ("author_a", "author_b", "author_c")
    ]
    events = [
        build_event(
            f"like_{index}",
            "post_liked",
            "viewer_1",
            reference_now - timedelta(hours=1, minutes=index),
            {"postId": f"older_{index}", "authorId": "author_c", "topics": ["music"]},
        )
        for index in range(6)
    ]
    await application_container.event_ingestion_service.ingest_event_batch(events)
    response = await rank_feed(
        application_container, {"viewer": build_viewer(), "candidates": candidates, "now": reference_now.isoformat()}
    )
    assert response.items[0].item_id == "post_author_c"
    assert "creator_affinity" in response.items[0].reasons


async def test_following_feed_is_chronological_with_bounded_boost(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = [
        {
            "itemId": f"post_{hours}",
            "authorId": f"author_{hours}",
            "createdAt": (reference_now - timedelta(hours=hours)).isoformat(),
            "likeCount": 1000 if hours == 3 else 0,
            "viewCount": 1000,
        }
        for hours in range(6)
    ]
    response = await rank_feed(
        application_container,
        {"feedMode": "following", "viewer": build_viewer(), "candidates": candidates, "now": reference_now.isoformat()},
    )
    assert [item.item_id for item in response.items] == [f"post_{hours}" for hours in range(6)]
    assert response.metadata.ranking_source.startswith("following:")


async def test_empty_candidates_return_empty_feed(application_container: ApplicationContainer) -> None:
    response = await rank_feed(application_container, {"viewer": build_viewer(), "candidates": []})
    assert response.items == []


class UnavailableFeatureBackend(InMemoryFeatureBackend):
    async def read_sorted_set_member_scores(self, key_and_member_requests: Any) -> list[list[float | None]]:
        raise FeatureBackendUnavailableError(f"down for {len(key_and_member_requests)} reads")


async def test_ranking_degrades_gracefully_when_feature_store_is_down(
    intelligence_settings: IntelligenceSettings, reference_now: datetime
) -> None:
    container = build_application_container(intelligence_settings, UnavailableFeatureBackend())
    response = await rank_feed(
        container,
        {
            "viewer": build_viewer(),
            "candidates": build_feed_candidates(reference_now, 20),
            "now": reference_now.isoformat(),
        },
    )
    assert response.metadata.degraded
    assert len(response.items) == 20


async def test_feed_endpoint_returns_camel_case_contract(signed_client: Any, reference_now: datetime) -> None:
    response = await signed_client.post(
        "/v1/feed/rank",
        {
            "viewer": build_viewer(),
            "candidates": build_feed_candidates(reference_now, 5),
            "now": reference_now.isoformat(),
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert set(body["metadata"]) >= {"requestId", "rankingSource", "modelVersion", "degraded", "generatedAt"}
    assert set(body["items"][0]) == {
        "itemId",
        "position",
        "score",
        "reasons",
        "explanations",
        "boostMultiplier",
        "trustedEngagementShare",
        "socialProof",
    }
