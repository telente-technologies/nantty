from datetime import datetime
from typing import Any

import pytest
from pydantic import ValidationError

from src.container import ApplicationContainer
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest, AdSelectionResponse
from tests.conftest import build_viewer

VIDEO_PORTRAIT: dict[str, Any] = {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 20_000}
VIDEO_LANDSCAPE: dict[str, Any] = {"mediaType": "video", "aspectRatio": "16:9", "durationMs": 45_000}
PRODUCT_TILE: dict[str, Any] = {"mediaType": "product_tile", "aspectRatio": "1:1", "productId": "product_1"}
LIVE_STREAM: dict[str, Any] = {
    "mediaType": "live_stream",
    "aspectRatio": "9:16",
    "isLiveNow": True,
    "liveStreamId": "live_1",
}
ALL_PLACEMENTS = ["feed", "clips", "mart", "search", "stories", "live", "live_discovery"]


def build_ad(index: int, creative: dict[str, Any]) -> dict[str, Any]:
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
        "placements": ALL_PLACEMENTS,
        "creative": creative,
    }


async def select_for_placement(
    container: ApplicationContainer,
    now: datetime,
    placement: str,
    creatives: list[dict[str, Any]],
    organic_count: int = 30,
    **overrides: Any,
) -> AdSelectionResponse:
    request = AdSelectionRequest.model_validate(
        {
            "placement": placement,
            "viewer": build_viewer(),
            "organicItems": [{"itemId": f"item_{index}"} for index in range(organic_count)],
            "candidates": [build_ad(index, creative) for index, creative in enumerate(creatives)],
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "now": now.isoformat(),
            **overrides,
        }
    )
    return await container.ad_selection_service.select_ads(request)


def rejection_reasons(response: AdSelectionResponse) -> dict[str, str]:
    return {rejected.ad_id: rejected.reason for rejected in response.rejected}


async def test_marketplace_grid_takes_only_product_tiles_outside_the_first_row(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    creatives = [PRODUCT_TILE] * 6 + [VIDEO_PORTRAIT, {"mediaType": "product_tile", "aspectRatio": "1:1"}]
    response = await select_for_placement(application_container, reference_now, "mart", creatives)
    assert [placement.position for placement in response.placements] == [2, 8, 14, 20, 26]
    assert all(placement.creative_media_type == "product_tile" for placement in response.placements)
    assert rejection_reasons(response)["ad_6"] == "creative_media_type_not_allowed"
    assert rejection_reasons(response)["ad_7"] == "product_tile_missing_product"
    wider_grid = await select_for_placement(
        application_container, reference_now, "mart", [PRODUCT_TILE], adLoad={"gridColumns": 3}
    )
    assert wider_grid.placements[0].position == 3


async def test_reels_accept_portrait_and_landscape_video_one_ad_per_five_clips(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    long_video = {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 90_000}
    creatives = [
        VIDEO_PORTRAIT,
        VIDEO_LANDSCAPE,
        LIVE_STREAM,
        {"mediaType": "image", "aspectRatio": "9:16"},
        long_video,
    ]
    response = await select_for_placement(application_container, reference_now, "clips", creatives, organic_count=14)
    assert [placement.position for placement in response.placements] == [2, 7, 12]
    reasons = rejection_reasons(response)
    assert reasons["ad_3"] == "creative_media_type_not_allowed"
    assert reasons["ad_4"] == "creative_video_too_long"


async def test_live_discovery_needs_streams_that_are_live_one_per_eight(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    ended_stream = {**LIVE_STREAM, "isLiveNow": False}
    creatives = [LIVE_STREAM, LIVE_STREAM, LIVE_STREAM, ended_stream]
    response = await select_for_placement(application_container, reference_now, "live_discovery", creatives, 20)
    assert [placement.position for placement in response.placements] == [1, 9, 17]
    assert rejection_reasons(response)["ad_3"] == "live_stream_not_live"


async def test_stories_reject_landscape_creatives(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    response = await select_for_placement(application_container, reference_now, "stories", [VIDEO_LANDSCAPE])
    assert response.placements == []
    assert rejection_reasons(response)["ad_0"] == "creative_aspect_ratio_not_allowed"


async def test_in_stream_live_ads_need_host_content_and_credit_the_host(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    without_host = await select_for_placement(application_container, reference_now, "live", [VIDEO_PORTRAIT], 0)
    assert without_host.placements == []
    assert rejection_reasons(without_host)["ad_0"] == "in_content_placement_requires_host_content"
    with_host = await select_for_placement(
        application_container,
        reference_now,
        "live",
        [VIDEO_PORTRAIT, PRODUCT_TILE],
        0,
        hostContentId="live_42",
        hostCreatorId="creator_7",
    )
    assert len(with_host.placements) == 1
    placement = with_host.placements[0]
    assert (placement.position, placement.insert_after_item_id) == (0, None)
    assert (placement.host_content_id, placement.host_creator_id, placement.placement) == (
        "live_42",
        "creator_7",
        "live",
    )


def test_unknown_placements_are_rejected_by_validation() -> None:
    with pytest.raises(ValidationError):
        AdSelectionRequest.model_validate(
            {
                "placement": "story",
                "viewer": build_viewer(),
                "organicItems": [],
                "candidates": [],
                "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            }
        )
