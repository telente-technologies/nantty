import { feedModuleCadence, minimumPostsBetweenFeedModules } from "@/constants/feedModules.constant";

export interface ProductRecommendationSlot {
  readonly kind: "productsYouMightLike";
  readonly occurrence: number;
  readonly afterPostCount: number;
}

/** Place organic recommendations by organic post count, without treating sponsored posts as cadence. */
export function planProductsYouMightLikeSlots<Post extends { readonly sponsored?: unknown }>(
  posts: readonly Post[],
  existingSlots: readonly { readonly afterPostCount: number }[],
  recommendationsAvailable: boolean,
  isForYouFeed: boolean,
): ProductRecommendationSlot[] {
  if (!isForYouFeed || !recommendationsAvailable) return [];

  const cadence = feedModuleCadence.productsYouMightLike;
  const organicBoundaries: number[] = [];
  let organicCount = 0;
  posts.forEach((post, index) => {
    if (post.sponsored != null && post.sponsored !== false) return;
    organicCount += 1;
    const repeatEvery = cadence.repeatEveryPosts ?? Number.POSITIVE_INFINITY;
    if (organicCount >= cadence.firstAfterPosts && (organicCount - cadence.firstAfterPosts) % repeatEvery === 0) {
      organicBoundaries.push(index + 1);
    }
  });

  const occupiedBoundaries = [...existingSlots.map((slot) => slot.afterPostCount)];
  const slots: ProductRecommendationSlot[] = [];
  for (const desiredBoundary of organicBoundaries) {
    let afterPostCount = desiredBoundary;
    while (afterPostCount <= posts.length && occupiedBoundaries.some((occupied) => Math.abs(occupied - afterPostCount) < minimumPostsBetweenFeedModules)) {
      afterPostCount += 1;
    }
    if (afterPostCount > posts.length) continue;
    slots.push({ kind: "productsYouMightLike", occurrence: slots.length, afterPostCount });
    occupiedBoundaries.push(afterPostCount);
  }
  return slots;
}

export function shouldFetchProductsYouMightLike(organicPostCount: number, isForYouFeed: boolean): boolean {
  return isForYouFeed && organicPostCount >= feedModuleCadence.productsYouMightLike.firstAfterPosts;
}
