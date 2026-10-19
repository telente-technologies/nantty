import { describe, expect, it } from "vitest";

import { toCatalogProductSummary } from "../../src/integrations/httpProductCatalog.integration.js";
import type { DecidedAd } from "../../src/interfaces/adDecisions.interface.js";
import { selectSocialProofDeterministically } from "../../src/modules/feeds/services/socialProof.service.js";
import { buildSponsoredPostView, toSponsoredPlacement } from "../../src/modules/feeds/services/sponsoredInsertion.service.js";
import { feedbackBodySchema, resolveFeedbackKind } from "../../src/modules/feeds/validators/feeds.validator.js";
import { matchesTopic } from "../../src/modules/feeds/services/rankedFeed.service.js";
import { buildClipEdit, clipDurationSeconds } from "../../src/modules/posts/services/postMediaResolution.service.js";
import { collectMediaSelection } from "../../src/modules/posts/controllers/posts.controller.js";
import { buildAudienceSplit, summariseEngagement } from "../../src/modules/posts/services/postAnalytics.service.js";
import { buildPostRow } from "../posts/socialPostFakes.fake.js";

const postId = "0192f0a0-0000-7000-8000-000000000001";

describe("feed feedback contract", () => {
  it("accepts the mobile `type` alias with not_interested", () => {
    const parsed = feedbackBodySchema.parse({ postId, type: "not_interested" });
    expect(resolveFeedbackKind(parsed)).toBe("notInterested");
    expect(resolveFeedbackKind(feedbackBodySchema.parse({ postId, type: "hide" }))).toBe("hide");
    expect(resolveFeedbackKind(feedbackBodySchema.parse({ postId, kind: "less" }))).toBe("less");
    expect(resolveFeedbackKind(feedbackBodySchema.parse({ postId }))).toBeUndefined();
  });
});

describe("topic chip", () => {
  it("matches posts by topic or hashtag", () => {
    expect(matchesTopic(buildPostRow({ topics: ["fashion"] }), "fashion")).toBe(true);
    expect(matchesTopic(buildPostRow({ topics: [], text: "new #Fashion drop" }), "fashion")).toBe(true);
    expect(matchesTopic(buildPostRow({ topics: ["food"], text: "" }), "fashion")).toBe(false);
    expect(matchesTopic(buildPostRow({ topics: [] }), undefined)).toBe(true);
  });
});

describe("friends liked", () => {
  it("needs two friends and keeps banners five posts apart", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ postId: `p${index}`, authorId: "a", likedByFriendIds: index === 1 ? ["f1"] : ["f1", "f2", "f3", "f4"] }));
    const selected = selectSocialProofDeterministically(items);
    expect(selected.map((selection) => selection.postId)).toEqual(["p0", "p5"]);
    expect(selected[0]).toMatchObject({ totalFriendCount: 4, friendIds: ["f1", "f2", "f3"] });
  });
});

describe("sponsored posts", () => {
  const ad: DecidedAd = {
    adId: "ad1", impressionToken: "tok", label: "Sponsored", clickLinks: { cta: "https://ads/c" },
    creative: {
      type: "single", mediaClickable: true, source: { type: "account", id: "acct" }, headline: "H", primaryText: "Buy", callToAction: "Shop now",
      media: [{ id: "m1", kind: "image", url: "https://cdn/a.jpg", posterUrl: null, width: 10, height: 10, durationSeconds: null }],
      destination: { type: "url", targetId: null, url: "https://shop" }, identity: { name: "Brand", handle: "brand", avatarUrl: null, verifiedBusiness: true },
    },
  };
  it("maps a go-ads decision to the mobile sponsored placement", () => {
    expect(toSponsoredPlacement(ad)).toMatchObject({ campaignId: "ad1", label: "Sponsored", advertiserName: "Brand", ctaLabel: "Shop now", ctaUrl: "https://shop", impressionToken: "tok" });
    const view = buildSponsoredPostView(ad, new Date("2026-10-05T00:00:00Z"));
    expect(view).toMatchObject({ id: "ad-ad1", text: "Buy", sponsored: { campaignId: "ad1" }, viewerCanReply: false });
    expect(view.media[0]?.url).toBe("https://cdn/a.jpg");
  });
  it("carries the promoted store or profile card so apps can render it", () => {
    const promoted = { kind: "store" as const, id: "store-1", name: "Ada Fabrics", handle: "adafabrics", avatarUrl: null, verified: true, checkmarkColor: "gold", private: false };
    const storeAd: DecidedAd = { ...ad, label: "Boosted", creative: { ...ad.creative, source: { type: "store", id: "store-1" }, media: [], destination: { type: "store", targetId: "store-1", url: null }, promoted } };
    expect(toSponsoredPlacement(storeAd)).toMatchObject({ label: "Boosted", destination: { type: "store", targetId: "store-1" }, promoted });
    expect(toSponsoredPlacement(ad)).not.toHaveProperty("promoted");
  });
  it("keeps boosted posts labelled Boosted, distinct from ads", () => {
    expect(toSponsoredPlacement({ ...ad, label: "Boosted" }).label).toBe("Boosted");
    expect(toSponsoredPlacement({ ...ad, label: "Ad" }).label).toBe("Sponsored");
  });
});

describe("clip composer fields", () => {
  it("collects media ids and trims from either field", () => {
    const selection = collectMediaSelection(["a"], [{ mediaId: "b", trim: { startMs: 0, endMs: 4000 } }, { id: "a" }]);
    expect(selection).toEqual({ mediaIds: ["a", "b"], mediaTrims: { b: { startMs: 0, endMs: 4000 } } });
  });
  it("stores trims for videos and derives the clip duration", () => {
    const media = [{ id: "v", type: "video" as const }];
    const edit = buildClipEdit({ kind: "clip", mediaTrims: { v: { startMs: 1000, endMs: 6000 } }, slideshow: undefined }, media);
    expect(edit).toEqual({ trims: { v: { startMs: 1000, endMs: 6000 } } });
    expect(clipDurationSeconds([{ mediaId: "v", type: "video", durationSeconds: 30 }], edit)).toBe(5);
    expect(clipDurationSeconds([{ mediaId: "v", type: "video", durationSeconds: 30 }], null)).toBe(30);
    expect(() => buildClipEdit({ kind: "clip", mediaTrims: { v: { startMs: 5000, endMs: 1000 } }, slideshow: undefined }, media)).toThrow(/end after/);
  });
  it("needs one slideshow duration per image", () => {
    const images = [{ id: "i1", type: "image" as const }, { id: "i2", type: "image" as const }];
    expect(clipDurationSeconds([], buildClipEdit({ kind: "clip", mediaTrims: undefined, slideshow: { durationsMs: [1500, 2500], transition: "crossfade" } }, images))).toBe(4);
    expect(() => buildClipEdit({ kind: "clip", mediaTrims: undefined, slideshow: { durationsMs: [1500], transition: "none" } }, images)).toThrow(/one duration/);
  });
});

describe("tagged products and analytics", () => {
  it("only tags active, public products from active stores", () => {
    const base = { productId: "p", storeId: "s", name: "Bag", priceAmountMinor: 5000, currency: "NGN", imageUrl: null, stock: 3, status: "active", visibility: "public", storeActive: true };
    expect(toCatalogProductSummary(base)).toMatchObject({ taggable: true, price: { amountMinor: 5000, currency: "NGN" } });
    expect(toCatalogProductSummary({ ...base, status: "draft" }).taggable).toBe(false);
    expect(toCatalogProductSummary({ ...base, visibility: "store_only" }).taggable).toBe(false);
    expect(toCatalogProductSummary({ ...base, storeActive: false }).taggable).toBe(false);
  });
  it("computes engagement rate and the follower split", () => {
    expect(summariseEngagement({ likes: 5, comments: 3, reposts: 1, shares: 1, saves: 0 }, 200)).toEqual({ engagements: 10, engagementRate: 0.05 });
    expect(summariseEngagement({ likes: 0, comments: 0, reposts: 0, shares: 0, saves: 0 }, 0).engagementRate).toBe(0);
    expect(buildAudienceSplit(1, 4)).toEqual([{ label: "Followers", share: 0.25 }, { label: "Non-followers", share: 0.75 }]);
    expect(buildAudienceSplit(0, 0)).toEqual([]);
  });
});
