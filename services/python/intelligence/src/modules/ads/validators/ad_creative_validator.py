from src.modules.ads.constants.ad_placement_policy_constant import AD_PLACEMENT_POLICIES
from src.modules.ads.dtos.ad_selection_dto import AdCreative, AdPlacement


def find_creative_format_violation(creative: AdCreative, placement: AdPlacement) -> str | None:
    policy = AD_PLACEMENT_POLICIES[placement]
    if creative.media_type not in policy.allowed_media_types:
        return "creative_media_type_not_allowed"
    if creative.aspect_ratio not in policy.allowed_aspect_ratios:
        return "creative_aspect_ratio_not_allowed"
    if (
        creative.media_type == "video"
        and policy.maximum_video_duration_ms is not None
        and (creative.duration_ms or 0) > policy.maximum_video_duration_ms
    ):
        return "creative_video_too_long"
    if creative.media_type == "live_stream" and not creative.is_live_now:
        return "live_stream_not_live"
    if creative.media_type == "product_tile" and creative.product_id is None:
        return "product_tile_missing_product"
    return None
