from collections.abc import Sequence
from dataclasses import dataclass

from app.models.ads_model import AdLoadOptions, OrganicSlotItem

MINIMUM_ORGANIC_ITEMS_BEFORE_FIRST_AD = 2
STRICT_BRAND_SAFETY_NEIGHBOUR_RADIUS = 2


@dataclass(frozen=True, slots=True)
class AdSlot:
    organic_items_before_slot: int
    is_safe_for_strict_brand_safety: bool


def is_organic_item_unsafe_for_ads(item: OrganicSlotItem) -> bool:
    return item.is_sensitive or item.is_reported


def are_neighbours_safe(organic_items: Sequence[OrganicSlotItem], organic_items_before_slot: int, radius: int) -> bool:
    first_index = max(organic_items_before_slot - radius, 0)
    last_index = min(organic_items_before_slot + radius, len(organic_items))
    return not any(is_organic_item_unsafe_for_ads(item) for item in organic_items[first_index:last_index])


def calculate_brand_safe_ad_slots(organic_items: Sequence[OrganicSlotItem], options: AdLoadOptions) -> list[AdSlot]:
    slots: list[AdSlot] = []
    earliest_allowed = max(options.first_ad_after_organic_items, MINIMUM_ORGANIC_ITEMS_BEFORE_FIRST_AD)
    organic_items_before_slot = earliest_allowed
    while organic_items_before_slot < len(organic_items) and len(slots) < options.maximum_ads:
        if not are_neighbours_safe(organic_items, organic_items_before_slot, 1):
            organic_items_before_slot += 1
            continue
        slots.append(
            AdSlot(
                organic_items_before_slot=organic_items_before_slot,
                is_safe_for_strict_brand_safety=are_neighbours_safe(
                    organic_items, organic_items_before_slot, STRICT_BRAND_SAFETY_NEIGHBOUR_RADIUS
                ),
            )
        )
        organic_items_before_slot += options.organic_items_between_ads
    return slots


def assign_ranked_ads_to_slots[AdType](
    ranked_ads: Sequence[AdType], slots: Sequence[AdSlot], requires_strict_brand_safety: dict[int, bool]
) -> list[tuple[AdSlot, AdType]]:
    assignments: list[tuple[AdSlot, AdType]] = []
    unassigned_indices = list(range(len(ranked_ads)))
    for slot in slots:
        chosen_index = next(
            (
                ad_index
                for ad_index in unassigned_indices
                if slot.is_safe_for_strict_brand_safety or not requires_strict_brand_safety[ad_index]
            ),
            None,
        )
        if chosen_index is None:
            continue
        unassigned_indices.remove(chosen_index)
        assignments.append((slot, ranked_ads[chosen_index]))
    return assignments
