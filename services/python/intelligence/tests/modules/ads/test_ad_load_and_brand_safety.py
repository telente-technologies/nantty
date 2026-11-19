import itertools
from datetime import datetime, timedelta
from typing import Any

from src.container import ApplicationContainer
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest, AdSelectionResponse
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle, LoadedModel
from tests.conftest import build_event, build_viewer


def build_ad(index: int, **overrides: Any) -> dict[str, Any]:
    return {
        "adId": f"ad_{index}",
        "campaignId": f"campaign_{index}",
        "advertiserId": f"advertiser_{index}",
        "status": "active",
        "bidType": "cpm",
        "bid": {"amountMinor": 1_000 + index * 100, "currency": "USD"},
        "dailyBudget": {"amountMinor": 10_000_000, "currency": "USD"},
        "spentToday": {"amountMinor": 0, "currency": "USD"},
        "spentTotal": {"amountMinor": 0, "currency": "USD"},
        "placements": ["feed", "clips", "live"],
        "creative": {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 15000},
        **overrides,
    }


def build_organic_items(count: int, unsafe_indices: set[int] | None = None) -> list[dict[str, Any]]:
    return [{"itemId": f"post_{index}", "isSensitive": index in (unsafe_indices or set())} for index in range(count)]


async def select(
    container: ApplicationContainer, reference_now: datetime, candidates: list[dict[str, Any]], **overrides: Any
) -> AdSelectionResponse:
    request = AdSelectionRequest.model_validate(
        {
            "placement": "feed",
            "viewer": build_viewer(),
            "organicItems": build_organic_items(30),
            "candidates": candidates,
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "now": reference_now.isoformat(),
            **overrides,
        }
    )
    return await container.ad_selection_service.select_ads(request)


def organic_items_before(position: int, ads_before: int) -> int:
    return position - ads_before


async def test_default_ad_load_places_first_ad_after_three_posts_and_six_posts_between_ads(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(application_container, reference_now, [build_ad(index) for index in range(8)])
    positions = [placement.position for placement in response.placements]
    assert positions == [3, 10, 17, 24, 31]
    for ads_before, placement in enumerate(response.placements):
        organic_count = organic_items_before(placement.position, ads_before)
        assert placement.insert_after_item_id == f"post_{organic_count - 1}"
    assert all(second - first >= 7 for first, second in itertools.pairwise(positions))


async def test_first_ad_is_never_above_the_first_two_posts(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(application_container, reference_now, [build_ad(1)], adLoad={"firstAdAfterOrganicItems": 2})
    assert response.placements[0].position == 2
    too_early = await select(
        application_container, reference_now, [build_ad(1)], adLoad={"firstAdAfterOrganicItems": 1}
    )
    assert too_early.placements[0].position == 2


async def test_maximum_ads_and_spacing_below_six_are_clamped(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(
        application_container, reference_now, [build_ad(index) for index in range(8)], adLoad={"maximumAds": 2}
    )
    assert len(response.placements) == 2
    dense = await select(
        application_container,
        reference_now,
        [build_ad(index) for index in range(8)],
        adLoad={"organicItemsBetweenAds": 3},
    )
    positions = [placement.position for placement in dense.placements]
    assert all(second - first >= 7 for first, second in itertools.pairwise(positions))


async def test_slot_moves_past_sensitive_and_reported_neighbours(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    organic = build_organic_items(20, {3})
    organic[10]["isReported"] = True
    response = await select(application_container, reference_now, [build_ad(1), build_ad(2)], organicItems=organic)
    organic_counts = [
        organic_items_before(placement.position, index) for index, placement in enumerate(response.placements)
    ]
    assert organic_counts == [5, 12]


async def test_strict_brand_safety_ad_needs_clean_neighbours_within_two_items(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(
        application_container,
        reference_now,
        [build_ad(1, brandSafety="strict")],
        organicItems=build_organic_items(20, {4}),
    )
    assert [placement.position for placement in response.placements] == [9]


async def test_host_content_context_is_echoed_on_every_placement(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(
        application_container,
        reference_now,
        [build_ad(index) for index in range(3)],
        placement="clips",
        hostContentId="clip_42",
        hostCreatorId="creator_7",
    )
    assert len(response.placements) == 3
    for placement in response.placements:
        assert (placement.placement, placement.host_content_id, placement.host_creator_id) == (
            "clips",
            "clip_42",
            "creator_7",
        )


async def test_sensitive_or_reported_host_content_receives_no_ads(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    for unsafe_flag in ("hostContentIsSensitive", "hostContentIsReported"):
        response = await select(
            application_container,
            reference_now,
            [build_ad(1)],
            hostContentId="post_host",
            hostCreatorId="creator_host",
            **{unsafe_flag: True},
        )
        assert response.placements == []


async def test_unsafe_host_content_rejection_reason_is_host_content_not_brand_safe(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(
        application_container, reference_now, [build_ad(1)], hostContentId="post_host", hostContentIsSensitive=True
    )
    assert [rejected.reason for rejected in response.rejected] == ["host_content_not_brand_safe"]


async def test_in_content_placement_without_organic_items_gets_single_position_zero_slot(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select(
        application_container,
        reference_now,
        [build_ad(index) for index in range(3)],
        placement="live",
        hostContentId="live_9",
        hostCreatorId="creator_9",
        organicItems=[],
    )
    assert len(response.placements) == 1
    assert response.placements[0].position == 0
    assert response.placements[0].insert_after_item_id is None


async def test_audience_targeting_mismatches_are_rejected_with_reasons(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    candidates = [
        build_ad(1, targeting={"countries": ["GH"]}),
        build_ad(2, targeting={"regions": ["LA"]}),
        build_ad(3, targeting={"ageBrackets": ["18-24"]}),
        build_ad(4, targeting={"topics": ["tech"]}),
        build_ad(5, targeting={"lookalikeStoreId": "store_unknown"}),
        build_ad(6, status="paused"),
        build_ad(7, endsAt=(reference_now - timedelta(hours=1)).isoformat()),
        build_ad(8, startsAt=(reference_now + timedelta(hours=1)).isoformat()),
        build_ad(9, advertiserId="advertiser_blocked"),
    ]
    response = await select(
        application_container,
        reference_now,
        candidates,
        viewer=build_viewer(chosenTopics=["food"], blockedAccountIds=["advertiser_blocked"]),
    )
    assert response.placements == []
    assert {rejected.ad_id: rejected.reason for rejected in response.rejected} == {
        "ad_1": "geo_mismatch",
        "ad_2": "geo_mismatch",
        "ad_3": "age_mismatch",
        "ad_4": "interest_mismatch",
        "ad_5": "lookalike_audience_unavailable",
        "ad_6": "not_active",
        "ad_7": "outside_schedule",
        "ad_8": "outside_schedule",
        "ad_9": "advertiser_blocked_by_viewer",
    }


async def test_lookalike_targeting_uses_store_customer_topic_centroid_and_threshold(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    await application_container.domain_event_consumer_service.purge_service.record_personalization_choice(
        "viewer_1", True
    )
    likes = [
        build_event(
            f"like_{index}",
            "post_liked",
            "viewer_1",
            reference_now,
            {"postId": f"post_{index}", "authorId": "author_1", "topics": ["fashion"]},
        )
        for index in range(3)
    ]
    await application_container.event_ingestion_service.ingest_event_batch(likes)
    application_container.model_holder.install_loaded_model(
        LoadedModel(
            model_name="item_similarity",
            version="20260101T000000Z-abcdef12",
            metadata={},
            bundle=ItemSimilarityBundle(
                store_customer_topic_centroids={"store_fashion": {"fashion": 1.0}, "store_tech": {"tech": 1.0}}
            ),
        )
    )
    response = await select(
        application_container,
        reference_now,
        [
            build_ad(1, targeting={"lookalikeStoreId": "store_fashion"}),
            build_ad(2, targeting={"lookalikeStoreId": "store_tech"}),
        ],
    )
    assert [placement.ad_id for placement in response.placements] == ["ad_1"]
    assert {rejected.ad_id: rejected.reason for rejected in response.rejected} == {"ad_2": "lookalike_mismatch"}
