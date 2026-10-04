import itertools
from datetime import datetime, timedelta
from typing import Any

from src.container import ApplicationContainer
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest
from src.modules.clips.services.exploration_sampling_service import calculate_exploration_slot_positions
from src.modules.feed.dtos.feed_ranking_dto import FriendEngagement
from src.modules.social_proof.services.social_proof_service import (
    SocialProofCandidate,
    SocialProofRules,
    select_posts_eligible_for_friend_social_proof,
)
from tests.conftest import SignedIntelligenceClient, build_viewer

DEFAULT_RULES = SocialProofRules(minimum_close_friends=2, minimum_gap_between_banners=5, minimum_closeness=0.3)


def build_engagements(*friend_ids: str, closeness: float = 0.9, action: str = "liked") -> list[FriendEngagement]:
    return [
        FriendEngagement.model_validate({"friendId": friend, "action": action, "closeness": closeness})
        for friend in friend_ids
    ]


def build_social_candidates(count: int, engagements: list[FriendEngagement]) -> list[SocialProofCandidate]:
    return [
        SocialProofCandidate(f"post_{index}", index, f"author_{index}", None, engagements) for index in range(count)
    ]


def test_social_proof_is_capped_to_one_banner_in_five_posts() -> None:
    selections = select_posts_eligible_for_friend_social_proof(
        build_social_candidates(40, build_engagements("friend_a", "friend_b", "friend_c")),
        "viewer_1",
        frozenset(),
        frozenset(),
        {},
        DEFAULT_RULES,
    )
    positions = sorted(selection.position for selection in selections.values())
    assert len(positions) == 8
    assert all(later - earlier >= 5 for earlier, later in itertools.pairwise(positions))
    for window_start in range(36):
        assert sum(1 for position in positions if window_start <= position < window_start + 5) <= 1


def test_social_proof_requires_enough_close_friends() -> None:
    weak = build_engagements("friend_a", "friend_b", closeness=0.1)
    lonely = build_engagements("friend_a")
    selections = select_posts_eligible_for_friend_social_proof(
        [
            SocialProofCandidate("post_weak", 0, "author", None, weak),
            SocialProofCandidate("post_lonely", 6, "author", None, lonely),
        ],
        "viewer_1",
        frozenset(),
        frozenset(),
        {},
        DEFAULT_RULES,
    )
    assert selections == {}


def test_social_proof_ignores_blocked_friends_and_uses_online_closeness() -> None:
    engagements = build_engagements("friend_a", "friend_blocked", closeness=0.0) + build_engagements(
        "friend_b", closeness=0.0
    )
    selections = select_posts_eligible_for_friend_social_proof(
        [SocialProofCandidate("post_1", 0, "author", None, engagements)],
        "viewer_1",
        frozenset(),
        frozenset({"friend_blocked"}),
        {"friend_a": 0.8, "friend_b": 0.7, "friend_blocked": 0.9},
        DEFAULT_RULES,
    )
    assert selections["post_1"].friend_ids == ["friend_a", "friend_b"]
    assert selections["post_1"].total_friend_count == 2


def test_social_proof_prefers_the_higher_value_post_within_a_window() -> None:
    candidates = [
        SocialProofCandidate(
            "post_followed", 0, "author_followed", None, build_engagements("friend_a", "friend_b", closeness=0.5)
        ),
        SocialProofCandidate(
            "post_new", 2, "author_new", None, build_engagements("friend_a", "friend_b", action="purchased")
        ),
    ]
    selections = select_posts_eligible_for_friend_social_proof(
        candidates, "viewer_1", frozenset({"author_followed"}), frozenset(), {}, DEFAULT_RULES
    )
    assert set(selections) == {"post_new"}
    assert selections["post_new"].primary_action == "purchased"


async def test_social_proof_endpoint_returns_selected_positions(signed_client: SignedIntelligenceClient) -> None:
    items = [
        {
            "itemId": f"post_{index}",
            "authorId": "author",
            "friendEngagements": [
                {"friendId": "friend_a", "action": "liked", "closeness": 0.9},
                {"friendId": "friend_b", "action": "shared", "closeness": 0.8},
            ],
        }
        for index in range(12)
    ]
    response = await signed_client.post("/v1/social-proof/select", {"viewer": build_viewer(), "orderedItems": items})
    assert response.status_code == 200
    assert [selection["position"] for selection in response.json()["selections"]] == [0, 5, 10]


def build_clip_candidates(now: datetime, count: int) -> list[dict[str, Any]]:
    return [
        {
            "itemId": f"clip_{index:03d}",
            "creatorId": f"creator_{index % 7}",
            "createdAt": (now - timedelta(hours=index)).isoformat(),
            "durationMs": 15_000,
            "topics": ["comedy"],
            "viewCount": 5 if index % 7 == 0 else 5_000,
            "completionCount": 2 if index % 7 == 0 else 2_000,
            "creatorIsNew": index % 7 == 0,
        }
        for index in range(count)
    ]


async def test_clip_ranking_has_exploration_slots_without_duplicates(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = build_clip_candidates(reference_now, 40)
    candidates.append(dict(candidates[3]))
    request = ClipRankingRequest.model_validate(
        {
            "requestId": "clips_1",
            "viewer": build_viewer(),
            "candidates": candidates,
            "limit": 20,
            "now": reference_now.isoformat(),
        }
    )
    response = await application_container.clip_ranking_service.rank_clips(request)
    item_ids = [item.item_id for item in response.items]
    creator_by_item = {candidate["itemId"]: candidate["creatorId"] for candidate in candidates}
    assert len(item_ids) == len(set(item_ids)) == 20
    assert all(creator_by_item[a] != creator_by_item[b] for a, b in itertools.pairwise(item_ids))
    exploration_positions = {item.position for item in response.items if item.is_exploration}
    assert exploration_positions <= calculate_exploration_slot_positions(20, 0.2)
    assert len(exploration_positions) >= 3
    assert all(creator_by_item[item.item_id] == "creator_0" for item in response.items if item.is_exploration)
    repeated = await application_container.clip_ranking_service.rank_clips(request)
    assert [item.item_id for item in repeated.items] == item_ids


async def test_clip_ranking_skips_already_watched_clips(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    request = ClipRankingRequest.model_validate(
        {
            "viewer": build_viewer(seenItemIds=["clip_001"]),
            "candidates": build_clip_candidates(reference_now, 10),
            "now": reference_now.isoformat(),
        }
    )
    response = await application_container.clip_ranking_service.rank_clips(request)
    assert "clip_001" not in {item.item_id for item in response.items}
    assert {excluded.item_id for excluded in response.excluded} == {"clip_001"}
