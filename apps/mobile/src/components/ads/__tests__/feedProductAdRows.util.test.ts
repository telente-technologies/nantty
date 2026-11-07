import { insertFeedProductAd, shouldDecideFeedProductAd } from "../feedProductAdRows.util";
import type { ProductAd } from "@/services/ads/productAds.service";
import type { SponsoredPlacement } from "@/types";
import type { FeedRowWithModules } from "@/utils/feedModuleLayout.util";

const ad = { adId: "ad-feed-1" } as ProductAd;
const sponsored: SponsoredPlacement = { campaignId: "ad-feed-1", label: "Sponsored", advertiserName: "Ada Atelier", impressionToken: "signed-token" };
const organic = (id: string) => ({ id, sponsored: null });
const rows: FeedRowWithModules<ReturnType<typeof organic>>[] = [
  { type: "post", post: organic("p1"), postIndex: 0 },
  { type: "post", post: organic("p2"), postIndex: 1 },
  { type: "post", post: organic("p3"), postIndex: 2 },
  { type: "post", post: organic("p4"), postIndex: 3 },
  { type: "post", post: organic("p5"), postIndex: 4 },
  { type: "post", post: organic("p6"), postIndex: 5 },
  { type: "post", post: organic("p7"), postIndex: 6 },
  { type: "post", post: organic("p8"), postIndex: 7 },
  { type: "module", slot: { kind: "peopleYouMayKnow", occurrence: 0, afterPostCount: 8 } },
  { type: "post", post: organic("p9"), postIndex: 8 },
];

describe("feed product ad row placement", () => {
  it("inserts a server product creative after eight organic posts without disturbing module rows", () => {
    const result = insertFeedProductAd(rows, ad, sponsored);
    expect(result.map((row) => row.type === "post" ? row.post.id : row.type === "module" ? row.slot.kind : row.ad.adId)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "ad-feed-1", "peopleYouMayKnow", "p9",
    ]);
  });

  it("does not inject a second ad alongside a server-injected sponsored post", () => {
    const existing: FeedRowWithModules<ReturnType<typeof organic>>[] = [
      { type: "post", post: { ...organic("server-ad"), sponsored }, postIndex: 0 },
      ...rows,
    ];
    expect(insertFeedProductAd(existing, ad, sponsored)).toHaveLength(existing.length);
  });

  it("does not insert when there is no server creative or fewer than eight feed posts", () => {
    expect(insertFeedProductAd(rows.slice(0, 2), ad, sponsored)).toHaveLength(2);
    expect(insertFeedProductAd(rows, null, sponsored)).toHaveLength(rows.length);
    expect(insertFeedProductAd(rows, ad, null)).toHaveLength(rows.length);
  });

  it("requests at most one product ad in For You after eight organic posts and never in Following", () => {
    expect(shouldDecideFeedProductAd("for-you", true, false, 8)).toBe(true);
    expect(shouldDecideFeedProductAd("following", true, false, 8)).toBe(false);
    expect(shouldDecideFeedProductAd("for-you", true, false, 7)).toBe(false);
    expect(shouldDecideFeedProductAd("for-you", true, true, 8)).toBe(false);
    expect(shouldDecideFeedProductAd("for-you", false, false, 8)).toBe(false);
  });
});
