from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.modules.recommendations.dtos.recommendation_dto import (
    AccountRecommendationRequest,
    ClipSuggestionRequest,
)
from src.modules.search.dtos.search_rerank_dto import SearchRerankRequest
from tests.conftest import build_event, build_viewer


async def test_account_suggestions_exclude_followed_blocked_and_self_and_favour_mutual_follows(
    application_container: ApplicationContainer,
) -> None:
    request = AccountRecommendationRequest.model_validate(
        {
            "viewer": build_viewer(followedAccountIds=["followed"], blockedAccountIds=["blocked"]),
            "candidates": [
                {"accountId": "stranger", "kind": "user", "followerCount": 10},
                {"accountId": "mutual_friend", "kind": "user", "mutualFollowCount": 8, "followerCount": 10},
                {"accountId": "followed", "kind": "user"},
                {"accountId": "blocked", "kind": "store"},
                {"accountId": "viewer_1", "kind": "user"},
            ],
        }
    )
    response = await application_container.account_and_clip_recommendation_service.recommend_accounts(request)
    assert [item.item_id for item in response.items] == ["mutual_friend", "stranger"]
    assert response.items[0].reason == "mutual_follows"
    valid_reasons = {"mutual_follows", "shared_interests", "you_engaged", "popular", "verified", "nearby"}
    assert all(item.reason in valid_reasons for item in response.items)


async def test_clip_suggestions_without_candidates_use_topic_popularity_and_skip_seen_clips(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    watches = [
        build_event(
            f"watch_{index}",
            "clip_watched",
            f"watcher_{index}",
            reference_now,
            {
                "clipId": f"clip_{index % 3}",
                "creatorId": "creator_1",
                "watchFraction": 0.95,
                "durationMs": 15_000,
                "topics": ["music"],
            },
        )
        for index in range(9)
    ]
    await application_container.event_ingestion_service.ingest_event_batch(watches)
    request = ClipSuggestionRequest.model_validate(
        {"viewer": build_viewer(chosenTopics=["music"], seenItemIds=["clip_0"]), "now": reference_now.isoformat()}
    )
    response = await application_container.account_and_clip_recommendation_service.suggest_clips(request)
    assert sorted(item.item_id for item in response.items) == ["clip_1", "clip_2"]
    assert all(item.reason == "topic:music" for item in response.items)


def build_search_request(candidates: list[dict[str, Any]], **overrides: Any) -> SearchRerankRequest:
    return SearchRerankRequest.model_validate({"viewer": build_viewer(), "candidates": candidates, **overrides})


async def test_search_rerank_keeps_text_relevance_dominant_and_uses_follows_to_break_ties(
    application_container: ApplicationContainer,
) -> None:
    candidates = [
        {"itemId": "weak_match", "itemType": "post", "textRelevanceScore": 2.0, "authorId": "followed"},
        {"itemId": "tie_stranger", "itemType": "post", "textRelevanceScore": 8.0, "authorId": "stranger"},
        {"itemId": "tie_followed", "itemType": "post", "textRelevanceScore": 8.0, "authorId": "followed"},
        {"itemId": "best_match", "itemType": "product", "textRelevanceScore": 10.0, "authorId": "stranger"},
        {"itemId": "best_match", "itemType": "product", "textRelevanceScore": 10.0, "authorId": "stranger"},
        {"itemId": "blocked_item", "itemType": "post", "textRelevanceScore": 10.0, "authorId": "blocked"},
    ]
    request = build_search_request(
        candidates, viewer=build_viewer(followedAccountIds=["followed"], blockedAccountIds=["blocked"])
    )
    first = await application_container.search_reranking_service.rerank(request)
    second = await application_container.search_reranking_service.rerank(request)
    order = [item.item_id for item in first.items]
    assert order == ["best_match", "tie_followed", "tie_stranger", "weak_match"]
    assert order == [item.item_id for item in second.items]


async def test_search_rerank_respects_limit(application_container: ApplicationContainer) -> None:
    candidates = [
        {"itemId": f"item_{index}", "itemType": "post", "textRelevanceScore": float(index)} for index in range(20)
    ]
    response = await application_container.search_reranking_service.rerank(build_search_request(candidates, limit=5))
    assert [item.item_id for item in response.items] == [f"item_{index}" for index in range(19, 14, -1)]
    assert [item.position for item in response.items] == list(range(5))
