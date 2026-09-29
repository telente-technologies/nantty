from dataclasses import dataclass

from src.modules.ads.dtos.ad_selection_dto import AdAspectRatio, AdMediaType, AdPlacement


@dataclass(frozen=True, slots=True)
class AdPlacementPolicy:
    allowed_media_types: frozenset[AdMediaType]
    allowed_aspect_ratios: frozenset[AdAspectRatio]
    maximum_video_duration_ms: int | None
    minimum_organic_items_before_first_ad: int
    default_organic_items_before_first_ad: int
    minimum_organic_items_between_ads: int
    excludes_first_grid_row: bool
    is_in_content_placement: bool


ALL_ASPECT_RATIOS: frozenset[AdAspectRatio] = frozenset({"1:1", "4:5", "9:16", "16:9"})

AD_PLACEMENT_POLICIES: dict[AdPlacement, AdPlacementPolicy] = {
    "feed": AdPlacementPolicy(
        frozenset({"image", "video", "carousel", "live_stream"}), ALL_ASPECT_RATIOS, 60_000, 2, 3, 6, False, False
    ),
    "clips": AdPlacementPolicy(
        frozenset({"video", "live_stream"}), frozenset({"9:16", "16:9"}), 60_000, 2, 2, 4, False, False
    ),
    "stories": AdPlacementPolicy(frozenset({"image", "video"}), frozenset({"9:16"}), 15_000, 2, 2, 4, False, False),
    "mart": AdPlacementPolicy(frozenset({"product_tile"}), frozenset({"1:1", "4:5"}), None, 0, 0, 5, True, False),
    "search": AdPlacementPolicy(
        frozenset({"product_tile", "image"}), frozenset({"1:1", "4:5"}), None, 0, 0, 5, True, False
    ),
    "live_discovery": AdPlacementPolicy(
        frozenset({"live_stream"}), frozenset({"9:16", "16:9"}), None, 1, 1, 7, False, False
    ),
    "live": AdPlacementPolicy(
        frozenset({"image", "video", "product_tile"}), ALL_ASPECT_RATIOS, 30_000, 0, 0, 1, False, True
    ),
}
