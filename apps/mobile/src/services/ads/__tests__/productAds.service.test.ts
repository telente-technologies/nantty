jest.mock("../../core/apiClient.service", () => ({ api: { post: jest.fn() } }));

import { api } from "../../core/apiClient.service";
import { FEED_PRODUCT_AD_SLOT, MART_PRODUCT_AD_SLOT, SEARCH_PRODUCT_AD_SLOT, productAdSponsoredPlacement, productAdsService, usableFeedProductAd, usableMartProductAd, usableSearchProductAd, type ProductAd } from "../productAds.service";

const mockedApi = api as jest.Mocked<typeof api>;

function sampleAd(overrides: Partial<ProductAd> = {}): ProductAd {
  return {
    adId: "ad-1",
    impressionToken: "signed-token-123",
    expiresAt: "2026-11-07T13:00:00.000Z",
    placement: "mart",
    slotKind: MART_PRODUCT_AD_SLOT,
    format: "product",
    label: "Ad",
    creative: {
      format: "product",
      media: [{ kind: "image", url: "https://cdn.nantty.test/product.jpg" }],
      headline: "Handwoven tote",
      primaryText: "Made by Ada Atelier",
      callToAction: "shop_now",
      destination: { type: "product", targetId: "product-7" },
      identity: { name: "Ada Atelier", handle: "adaatelier", verifiedBusiness: true },
    },
    ...overrides,
  };
}

describe("Mart product-ad contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requests the supported martTile product-ad slot without sending recommendation signals", async () => {
    mockedApi.post.mockResolvedValueOnce({ ad: null, declinedReason: "no_fill" });

    await productAdsService.decideMartProductAd();

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/ads/decide", {
      slot: { kind: "martTile" },
      sessionId: expect.stringMatching(/^product_ads_/),
    });
  });

  it("requests the server-supported searchTile product slot without client-authored targeting data", async () => {
    mockedApi.post.mockResolvedValueOnce({ ad: null, declinedReason: "no_fill" });

    await productAdsService.decideSearchProductAd();

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/ads/decide", {
      slot: { kind: SEARCH_PRODUCT_AD_SLOT },
      sessionId: expect.stringMatching(/^product_ads_/),
    });
  });

  it("requests one conservative product slot using feedProduct and neighbouring organic posts", async () => {
    mockedApi.post.mockResolvedValueOnce({ ad: null, declinedReason: "no_fill" });

    await productAdsService.decideFeedProductAd("post-8", ["post-1", "post-2", "post-3", "post-4", "post-5", "post-6", "post-7", "post-8", "post-9", "post-10", "ignored-11"], "feed_product_ads_test-session");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/ads/decide", {
      slot: {
        kind: FEED_PRODUCT_AD_SLOT,
        contentId: "post-8",
        neighbourContentIds: ["post-1", "post-2", "post-3", "post-4", "post-5", "post-6", "post-7", "post-8", "post-9", "post-10"],
        slotsSinceLastAd: 8,
        slotIndex: 8,
      },
      sessionId: "feed_product_ads_test-session",
    });
  });

  it("renders only unexpired product creatives with internal product destinations and trusted image media", () => {
    expect(usableMartProductAd(sampleAd(), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(true);
    expect(usableMartProductAd(sampleAd({ placement: "feed" }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
    expect(usableMartProductAd(sampleAd({ expiresAt: "2026-11-07T11:00:00.000Z" }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
    expect(usableMartProductAd(sampleAd({ creative: { ...sampleAd().creative, destination: { type: "url", url: "https://outside.example" } } }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
    expect(usableMartProductAd(sampleAd({ creative: { ...sampleAd().creative, media: [{ kind: "image", url: "http://unsafe.example/image.jpg" }] } }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
  });

  it("accepts only feedProduct decisions with unexpired signed product destinations", () => {
    const feedAd = sampleAd({ placement: "feed", slotKind: FEED_PRODUCT_AD_SLOT });
    expect(usableFeedProductAd(feedAd, Date.parse("2026-11-07T12:00:00.000Z"))).toBe(true);
    expect(usableFeedProductAd(sampleAd({ ...feedAd, format: "feed_post" }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
    expect(usableFeedProductAd(sampleAd({ ...feedAd, slotKind: MART_PRODUCT_AD_SLOT }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
    expect(usableFeedProductAd(sampleAd({ ...feedAd, creative: { ...feedAd.creative, format: "feed_post" } }), Date.parse("2026-11-07T12:00:00.000Z"))).toBe(false);
  });

  it("accepts only unexpired searchTile product decisions with signed internal product destinations", () => {
    const searchAd = sampleAd({ placement: "search", slotKind: SEARCH_PRODUCT_AD_SLOT });
    const now = Date.parse("2026-11-07T12:00:00.000Z");
    expect(usableSearchProductAd(searchAd, now)).toBe(true);
    expect(usableSearchProductAd(sampleAd({ ...searchAd, placement: "mart" }), now)).toBe(false);
    expect(usableSearchProductAd(sampleAd({ ...searchAd, slotKind: MART_PRODUCT_AD_SLOT }), now)).toBe(false);
    expect(usableSearchProductAd(sampleAd({ ...searchAd, impressionToken: "" }), now)).toBe(false);
    expect(usableSearchProductAd(sampleAd({ ...searchAd, expiresAt: "2026-11-07T11:00:00.000Z" }), now)).toBe(false);
    expect(usableSearchProductAd(sampleAd({ ...searchAd, creative: { ...searchAd.creative, destination: { type: "url", url: "https://outside.example" } } }), now)).toBe(false);
  });

  it("maps the signed decision to the existing sponsored event/click contract", () => {
    expect(productAdSponsoredPlacement(sampleAd())).toMatchObject({
      campaignId: "ad-1",
      label: "Sponsored",
      advertiserName: "Ada Atelier",
      ctaLabel: "shop_now",
      impressionToken: "signed-token-123",
      destination: { type: "product", targetId: "product-7" },
    });
  });
});
