import type { ProductSummary } from "@/types";

export interface ClipRecommendationCadence {
  readonly firstAfterPosts: number;
  readonly repeatEveryPosts: number | null;
}

export function clipProductRecommendationIndexes(
  clips: readonly { readonly sponsored?: unknown }[],
  cadence: ClipRecommendationCadence,
  isForYouFeed: boolean,
  hasRecommendations: boolean,
): ReadonlySet<number> {
  const indexes = new Set<number>();
  if (!isForYouFeed || !hasRecommendations || cadence.repeatEveryPosts === null) return indexes;
  let organicCount = 0;
  clips.forEach((clip, index) => {
    if (clip.sponsored != null && clip.sponsored !== false) return;
    organicCount += 1;
    if (shouldShowClipProductRecommendations(organicCount, cadence, true, true)) indexes.add(index);
  });
  return indexes;
}

export function shouldShowClipProductRecommendations(
  postNumber: number,
  cadence: ClipRecommendationCadence,
  isForYouFeed: boolean,
  hasRecommendations: boolean,
): boolean {
  if (!isForYouFeed || !hasRecommendations || cadence.repeatEveryPosts === null || postNumber < cadence.firstAfterPosts) return false;
  return (postNumber - cadence.firstAfterPosts) % cadence.repeatEveryPosts === 0;
}

export function clipProductRecommendations(
  products: readonly ProductSummary[],
  taggedProductIds: readonly string[],
  limit = 6,
): readonly ProductSummary[] {
  const tagged = new Set(taggedProductIds);
  return products.filter((product) => !tagged.has(product.id)).slice(0, Math.max(0, limit));
}
