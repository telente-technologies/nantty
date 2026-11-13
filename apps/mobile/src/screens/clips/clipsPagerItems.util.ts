import type { Clip } from "@/types";
import type { ProductRecommendationSlot } from "@/utils/productsYouMightLikeLayout.util";

export type ClipsPagerItem =
  | { readonly kind: "clip"; readonly key: string; readonly clip: Clip; readonly clipIndex: number }
  | { readonly kind: "productRecommendations"; readonly key: string; readonly occurrence: number };

export function buildClipsPagerItems(
  clips: readonly Clip[],
  productSlots: readonly ProductRecommendationSlot[],
): ClipsPagerItem[] {
  const slotsByBoundary = new Map<number, ProductRecommendationSlot[]>();
  for (const slot of productSlots) {
    const slots = slotsByBoundary.get(slot.afterPostCount) ?? [];
    slots.push(slot);
    slotsByBoundary.set(slot.afterPostCount, slots);
  }

  const items: ClipsPagerItem[] = [];
  clips.forEach((clip, clipIndex) => {
    items.push({ kind: "clip", key: `clip-${clip.id}`, clip, clipIndex });
    for (const slot of slotsByBoundary.get(clipIndex + 1) ?? []) {
      items.push({ kind: "productRecommendations", key: `product-recommendations-${slot.occurrence}`, occurrence: slot.occurrence });
    }
  });
  return items;
}

export function clipsPagerItemIndexForClip(items: readonly ClipsPagerItem[], clipIndex: number): number {
  return items.findIndex((item) => item.kind === "clip" && item.clipIndex === clipIndex);
}

export function clipOrdinalAtOrBeforePagerItem(items: readonly ClipsPagerItem[], pagerItemIndex: number): number {
  for (let index = Math.min(pagerItemIndex, items.length - 1); index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === "clip") return item.clipIndex;
  }
  return -1;
}

export function clipForPagerAdImpression(item: ClipsPagerItem): Clip | null {
  return item.kind === "clip" ? item.clip : null;
}
