import itertools
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from src.container import ApplicationContainer
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest, ClipRankingResponse
from tests.conftest import SignedIntelligenceClient, build_event, build_viewer


def build_clip(now: datetime, item_id: str, creator_id: str, **overrides: Any) -> dict[str, Any]:
    return {
        "itemId": item_id,
        "creatorId": creator_id,
        "createdAt": (now - timedelta(hours=2)).isoformat(),
        "durationMs": 15_000,
        "viewCount": 1_000,
        "completionCount": 300,
        **overrides,
    }


async def rank(
    container: ApplicationContainer, now: datetime, candidates: list[dict[str, Any]], **request: Any
) -> ClipRankingResponse:
    payload = {
        "requestId": "clips_signals",
        "viewer": build_viewer(),
        "candidates": candidates,
        "limit": 20,
        "explorationShare": 0,
        "now": now.isoformat(),
        **request,
    }
    return await container.clip_ranking_service.rank_clips(ClipRankingRequest.model_validate(payload))


def order(response: ClipRankingResponse) -> list[str]:
    return [item.item_id for item in response.items]


async def test_high_completion_outranks_likes_only(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_clip(reference_now, "liked_clip", "creator_a", completionCount=50, likeCount=600, shareCount=50),
            build_clip(reference_now, "watched_clip", "creator_b", completionCount=900),
        ],
    )
    assert order(response) == ["watched_clip", "liked_clip"]


async def test_engagement_breaks_ties_between_equal_watch_signals(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_clip(reference_now, "plain", "creator_a"),
            build_clip(reference_now, "liked", "creator_b", likeCount=200),
        ],
    )
    assert order(response) == ["liked", "plain"]


async def test_fake_engagement_is_discounted(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    suspicious = {"engagerCount": 400, "clusteredEngagerShare": 0.8, "purchasedEngagementSuspected": True}
    response = await rank(
        application_container,
        reference_now,
        [
            build_clip(reference_now, "honest", "creator_a", completionCount=600),
            build_clip(reference_now, "farmed", "creator_b", completionCount=700, likeCount=900, integrity=suspicious),
        ],
    )
    assert order(response) == ["honest", "farmed"]
    assert response.manipulated_item_ids == ["farmed"]
    farmed = next(item for item in response.items if item.item_id == "farmed")
    assert farmed.trusted_engagement_share < 0.3


async def test_checkmark_boost_is_capped_and_disclosed(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_clip(reference_now, "black", "creator_a", authorTier="black_official", authorIsOfficial=True),
            build_clip(reference_now, "blue", "creator_b", authorTier="blue_verified"),
            build_clip(reference_now, "plain", "creator_c"),
        ],
        boostPolicy={
            "version": 7,
            "tierBoosts": {"black_official": 3.0, "blue_verified": 2.0},
            "officialEditorialBoost": 5.0,
        },
    )
    boosts = {item.item_id: item.boost_multiplier for item in response.items}
    assert boosts == {"black": 1.25, "blue": 1.08, "plain": 1.0}
    assert response.boost_policy_version == 7
    black = next(item for item in response.items if item.item_id == "black")
    assert black.explanations[-1].code == "official_boost"
    assert "25%" in (black.explanations[-1].detail or "")
    plain = next(item for item in response.items if item.item_id == "plain")
    assert all(explanation.code not in {"checkmark_boost", "official_boost"} for explanation in plain.explanations)
    assert order(response) == ["black", "blue", "plain"]


async def test_no_consecutive_clips_from_the_same_creator(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = [
        build_clip(reference_now, f"hot_{index}", "creator_hot", completionCount=950 - index) for index in range(6)
    ] + [build_clip(reference_now, f"other_{index}", f"creator_{index}", completionCount=200) for index in range(6)]
    response = await rank(application_container, reference_now, candidates, explorationShare=0.2)
    creator_by_item = {candidate["itemId"]: candidate["creatorId"] for candidate in candidates}
    items = order(response)
    assert len(items) == len(set(items)) == 12
    assert all(creator_by_item[left] != creator_by_item[right] for left, right in itertools.pairwise(items))


async def test_freshness_decays_older_clips(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_clip(reference_now, "old", "creator_a", createdAt=(reference_now - timedelta(days=9)).isoformat()),
            build_clip(reference_now, "new", "creator_b", createdAt=(reference_now - timedelta(hours=1)).isoformat()),
        ],
    )
    scores = {item.item_id: item.score for item in response.items}
    assert order(response) == ["new", "old"]
    assert scores["old"] < scores["new"] * 0.25


async def test_sensitive_clips_are_withheld_from_unknown_age_viewers(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = [
        build_clip(reference_now, "safe", "creator_a"),
        build_clip(reference_now, "sensitive", "creator_b", isSensitive=True),
    ]
    response = await rank(application_container, reference_now, candidates)
    assert order(response) == ["safe"]
    assert {item.item_id: item.reason for item in response.excluded} == {"sensitive": "sensitive_for_viewer"}
    adult = await rank(application_container, reference_now, candidates, viewer=build_viewer(ageBracket="25-34"))
    assert set(order(adult)) == {"safe", "sensitive"}


def build_watch(index: int, actor_id: str, clip_id: str, creator_id: str, now: datetime) -> dict[str, Any]:
    payload = {"clipId": clip_id, "creatorId": creator_id, "watchFraction": 1.0, "loopCount": 1, "durationMs": 15_000}
    return build_event(f"watch_{clip_id}_{index}", "clip_watched", actor_id, now, payload)


async def test_ingested_watch_events_move_a_clip_up(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    candidates = [
        build_clip(reference_now, "clip_a", "creator_a", viewCount=0, completionCount=0, likeCount=3),
        build_clip(reference_now, "clip_b", "creator_b", viewCount=0, completionCount=0),
    ]
    request = {
        "viewer": build_viewer(),
        "candidates": candidates,
        "explorationShare": 0,
        "now": reference_now.isoformat(),
    }
    before = (await signed_client.post("/v1/clips/rank", request)).json()
    assert [item["itemId"] for item in before["items"]] == ["clip_a", "clip_b"]
    watches = [build_watch(index, f"watcher_{index}", "clip_b", "creator_b", reference_now) for index in range(40)]
    accepted = (await signed_client.post("/v1/events", {"events": watches})).json()
    assert accepted["accepted"] == 40
    after = (await signed_client.post("/v1/clips/rank", request)).json()
    assert [item["itemId"] for item in after["items"]] == ["clip_b", "clip_a"]


async def test_non_personalized_ranking_ignores_viewer_history(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    candidates = [build_clip(reference_now, "clip_a", "creator_a"), build_clip(reference_now, "clip_b", "creator_b")]
    watched = build_watch(0, "viewer_1", "clip_a", "creator_a", reference_now)
    await signed_client.post("/v1/events", {"events": [watched]})
    base = {"viewer": build_viewer(), "candidates": candidates, "explorationShare": 0, "now": reference_now.isoformat()}
    personalized = (await signed_client.post("/v1/clips/rank", base)).json()
    assert "clip_a" not in [item["itemId"] for item in personalized["items"]]
    anonymous = (await signed_client.post("/v1/clips/rank", {**base, "personalized": False})).json()
    assert {item["itemId"] for item in anonymous["items"]} == {"clip_a", "clip_b"}
    assert anonymous["metadata"]["rankingSource"].endswith(":non_personalized")


async def test_social_request_contract_is_accepted(signed_client: SignedIntelligenceClient) -> None:
    payload = json.loads((Path(__file__).parent / "fixtures" / "social_clip_rank_request.json").read_text())
    ClipRankingRequest.model_validate(payload)
    response = await signed_client.post("/v1/clips/rank", payload)
    assert response.status_code == 200
    body = response.json()
    assert {"items", "excluded", "manipulatedItemIds", "boostPolicyVersion", "metadata"} <= body.keys()
    first = body["items"][0]
    assert {"itemId", "position", "score", "explanations", "boostMultiplier", "trustedEngagementShare"} <= first.keys()
    assert {item["itemId"] for item in body["items"]} == {candidate["itemId"] for candidate in payload["candidates"]}
    unknown_field = {**payload, "candidates": [{**payload["candidates"][0], "rawAuthorId": "leak"}]}
    assert (await signed_client.post("/v1/clips/rank", unknown_field)).status_code == 422
