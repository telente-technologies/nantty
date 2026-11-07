import { FEED_PRODUCT_AD_SLOT_INDEX, type ProductAd } from "@/services/ads/productAds.service";
import type { SponsoredPlacement } from "@/types";
import type { FeedRowWithModules } from "@/utils/feedModuleLayout.util";

export interface FeedProductAdRow {
  readonly type: "product-ad";
  readonly key: string;
  readonly id: string;
  readonly ad: ProductAd;
  readonly sponsored: SponsoredPlacement;
}

export type FeedDisplayRow<Post> = FeedRowWithModules<Post> | FeedProductAdRow;

export function shouldDecideFeedProductAd(
  feedMode: "for-you" | "following",
  hasViewer: boolean,
  firstPageHasSponsoredPost: boolean,
  organicPostCount: number,
): boolean {
  return feedMode === "for-you" && hasViewer && !firstPageHasSponsoredPost && organicPostCount >= FEED_PRODUCT_AD_SLOT_INDEX;
}

export function insertFeedProductAd<Post extends { readonly sponsored?: SponsoredPlacement | null }>(
  rows: readonly FeedRowWithModules<Post>[],
  ad: ProductAd | null,
  sponsored: SponsoredPlacement | null,
): FeedDisplayRow<Post>[] {
  if (!ad || !sponsored || rows.some((row) => row.type === "post" && row.post.sponsored)) return [...rows];

  let organicPostsSeen = 0;
  let inserted = false;
  const result: FeedDisplayRow<Post>[] = [];
  for (const row of rows) {
    result.push(row);
    if (row.type !== "post" || row.post.sponsored) continue;
    organicPostsSeen += 1;
    if (organicPostsSeen === FEED_PRODUCT_AD_SLOT_INDEX) {
      result.push({ type: "product-ad", key: `feed-product-ad-${ad.adId}`, id: ad.adId, ad, sponsored });
      inserted = true;
    }
  }
  return inserted ? result : [...rows];
}
