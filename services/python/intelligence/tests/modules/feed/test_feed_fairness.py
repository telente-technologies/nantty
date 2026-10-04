from datetime import datetime, timedelta
from typing import Any

from src.constants.ranking_boost_caps_constant import HARD_MAXIMUM_COMBINED_BOOST, HARD_MAXIMUM_TIER_BOOST
from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.interfaces.feature_backend_interface import HashFieldIncrement
from src.modules.feed.dtos.feed_fairness_dto import EngagementIntegritySignals, RankingBoostPolicy
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest, FeedRankingResponse
from src.services.engagement_integrity_service import assess_engagement_integrity
from src.services.ranking_boost_policy_service import (
    calculate_capped_author_boost,
    clamp_boost_policy_to_hard_caps,
)
from tests.conftest import build_viewer


def build_candidate(now: datetime, item_id: str, author_id: str, **overrides: Any) -> dict[str, Any]:
    return {
        "itemId": item_id,
        "authorId": author_id,
        "createdAt": (now - timedelta(hours=2)).isoformat(),
        "topics": ["music"],
        "likeCount": 10,
        "commentCount": 1,
        "viewCount": 1000,
        **overrides,
    }


async def rank(
    container: ApplicationContainer, now: datetime, candidates: list[dict[str, Any]], **extra: Any
) -> FeedRankingResponse:
    payload = {"viewer": build_viewer(), "candidates": candidates, "now": now.isoformat(), **extra}
    return await container.feed_ranking_service.rank_feed(FeedRankingRequest.model_validate(payload))


def test_admin_weights_are_clamped_to_hard_caps_and_tier_order() -> None:
    policy = clamp_boost_policy_to_hard_caps(
        RankingBoostPolicy(
            tier_boosts={
                "blue_essential": 1.04,
                "blue_verified": 1.01,
                "premium": 9.0,
                "gold_business": 1.0,
                "black_official": 3.0,
            },
            official_editorial_boost=5.0,
        )
    )
    assert policy.tier_boosts["premium"] == HARD_MAXIMUM_TIER_BOOST["premium"]
    assert policy.tier_boosts["black_official"] == HARD_MAXIMUM_TIER_BOOST["black_official"]
    assert policy.tier_boosts["blue_verified"] >= policy.tier_boosts["blue_essential"]
    assert policy.tier_boosts["gold_business"] >= policy.tier_boosts["premium"]
    assert policy.official_editorial_boost == 1.15
    assert calculate_capped_author_boost("black_official", True, policy) == HARD_MAXIMUM_COMBINED_BOOST
    assert calculate_capped_author_boost("none", False, policy) == 1.0


async def test_free_post_with_much_better_engagement_outranks_a_maximally_boosted_weak_post(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_candidate(
                reference_now, "boosted_weak", "official_author", authorTier="black_official", authorIsOfficial=True
            ),
            build_candidate(reference_now, "free_strong", "free_author", likeCount=120, commentCount=30, shareCount=20),
        ],
        boostPolicy={"tierBoosts": {"black_official": 99.0}, "officialEditorialBoost": 9.0},
    )
    assert [item.item_id for item in response.items] == ["free_strong", "boosted_weak"]
    boosted = next(item for item in response.items if item.item_id == "boosted_weak")
    assert boosted.boost_multiplier <= HARD_MAXIMUM_COMBINED_BOOST
    assert any(explanation.code == "official_boost" for explanation in boosted.explanations)


async def test_equal_posts_are_ordered_by_the_disclosed_boost(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_candidate(reference_now, "free_equal", "author_a"),
            build_candidate(reference_now, "gold_equal", "author_b", authorTier="gold_business"),
        ],
    )
    assert response.items[0].item_id == "gold_equal"
    assert 1.0 < response.items[0].boost_multiplier <= HARD_MAXIMUM_TIER_BOOST["gold_business"]


def test_coordinated_and_low_trust_engagement_is_discounted_and_flagged() -> None:
    clean = assess_engagement_integrity(EngagementIntegritySignals(engager_count=200))
    ring = assess_engagement_integrity(
        EngagementIntegritySignals(
            engager_count=200, clustered_engager_share=0.7, new_account_engager_share=0.3, burst_ratio=0.8
        )
    )
    pod = assess_engagement_integrity(EngagementIntegritySignals(engager_count=40, reciprocal_pod_share=0.9))
    purchased = assess_engagement_integrity(
        EngagementIntegritySignals(engager_count=40, purchased_engagement_suspected=True)
    )
    small = assess_engagement_integrity(EngagementIntegritySignals(engager_count=3, clustered_engager_share=1.0))
    assert clean.trusted_engagement_share == 1.0
    assert not clean.manipulated
    assert ring.trusted_engagement_share < 0.2
    assert ring.manipulated
    assert "coordinated_cluster" in ring.reasons
    assert "engagement_burst" in ring.reasons
    assert pod.manipulated
    assert "reciprocal_pod" in pod.reasons
    assert purchased.manipulated
    assert purchased.trusted_engagement_share <= 0.2
    assert not small.manipulated


async def test_manipulated_engagement_loses_to_honest_engagement_in_the_feed(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [
            build_candidate(
                reference_now,
                "ring_post",
                "ring_author",
                likeCount=300,
                integrity={"engagerCount": 300, "clusteredEngagerShare": 0.8, "lowTrustEngagerShare": 0.5},
            ),
            build_candidate(
                reference_now, "honest_post", "honest_author", likeCount=150, integrity={"engagerCount": 150}
            ),
        ],
    )
    assert response.items[0].item_id == "honest_post"
    assert response.manipulated_item_ids == ["ring_post"]


async def test_online_integrity_counters_from_valkey_discount_engagement(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    key = application_container.feature_store.keyspace.item_statistics_key("valkey_ring")
    await feature_backend.apply_write_operations(
        [
            HashFieldIncrement(key, "integrity_engagements", 100),
            HashFieldIncrement(key, "integrity_clustered", 90),
        ]
    )
    response = await rank(
        application_container,
        reference_now,
        [build_candidate(reference_now, "valkey_ring", "author_r", likeCount=200)],
    )
    assert response.manipulated_item_ids == ["valkey_ring"]
    assert response.items[0].trusted_engagement_share < 0.3


async def test_age_restricted_and_sensitive_posts_never_reach_minors(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = [
        build_candidate(reference_now, "restricted", "author_a", ageRestricted=True),
        build_candidate(reference_now, "sensitive", "author_b", isSensitive=True),
        build_candidate(reference_now, "safe", "author_c"),
    ]
    minor = await container_rank_for_viewer(application_container, reference_now, candidates, "13-17")
    adult = await container_rank_for_viewer(application_container, reference_now, candidates, "25-34")
    assert [item.item_id for item in minor.items] == ["safe"]
    assert {excluded.reason for excluded in minor.excluded} == {"age_restricted", "sensitive_for_viewer"}
    assert {item.item_id for item in adult.items} == {"restricted", "sensitive", "safe"}


async def container_rank_for_viewer(
    container: ApplicationContainer, now: datetime, candidates: list[dict[str, Any]], age_bracket: str
) -> FeedRankingResponse:
    payload = {"viewer": build_viewer(ageBracket=age_bracket), "candidates": candidates, "now": now.isoformat()}
    return await container.feed_ranking_service.rank_feed(FeedRankingRequest.model_validate(payload))


async def test_promoted_and_trending_explanations_are_returned(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await rank(
        application_container,
        reference_now,
        [build_candidate(reference_now, "promo", "author_p", isPromoted=True, hashtags=["afrobeats"])],
        trendingTopics=["afrobeats"],
    )
    codes = [explanation.code for explanation in response.items[0].explanations]
    assert codes[:2] == ["promoted", "trending_topic"]
