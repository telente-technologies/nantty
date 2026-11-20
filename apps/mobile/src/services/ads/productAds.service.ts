import { createSecureRandomHex } from "@/utils/secureRandomId.util";
import type { AdDestination, ID, SponsoredPlacement } from "@/types";

import { api } from "../core/apiClient.service";

export const MART_PRODUCT_AD_SLOT = "martTile" as const;
export const FEED_PRODUCT_AD_SLOT = "feedProduct" as const;
export const SEARCH_PRODUCT_AD_SLOT = "searchTile" as const;
export const FEED_PRODUCT_AD_SLOT_INDEX = 8;
const adSessionId = `product_ads_${Date.now().toString(36)}_${createSecureRandomHex(6)}`;

export const createFeedProductAdSessionId = () => `feed_product_ads_${Date.now().toString(36)}_${createSecureRandomHex(6)}`;

type ProductAdPlacement = "mart" | "feed" | "search";
type ProductAdSlot = typeof MART_PRODUCT_AD_SLOT | typeof FEED_PRODUCT_AD_SLOT | typeof SEARCH_PRODUCT_AD_SLOT;

export interface ProductAdDecision {
  readonly ad: ProductAd | null;
  readonly declinedReason?: string;
  readonly receivedAt?: number;
}

export interface ProductAd {
  readonly adId: ID;
  readonly impressionToken: string;
  readonly expiresAt: string;
  readonly placement: ProductAdPlacement;
  readonly slotKind: ProductAdSlot;
  readonly format: "product";
  readonly label: "Ad" | "Sponsored";
  readonly creative: {
    readonly format: "product";
    readonly media: readonly { readonly kind: "image" | "video"; readonly url: string; readonly posterUrl?: string | null }[];
    readonly headline: string;
    readonly primaryText: string;
    readonly callToAction: string;
    readonly destination: AdDestination;
    readonly identity: { readonly name: string; readonly handle: string; readonly avatarUrl?: string | null; readonly verifiedBusiness: boolean };
  };
}

export const productAdSponsoredPlacement = (ad: ProductAd): SponsoredPlacement => ({
  campaignId: ad.adId,
  label: ad.label === "Ad" ? "Sponsored" : ad.label,
  advertiserName: ad.creative.identity.name,
  ctaLabel: ad.creative.callToAction,
  impressionToken: ad.impressionToken,
  destination: ad.creative.destination,
});

export function usableMartProductAd(value: ProductAd | null | undefined, now: number): value is ProductAd {
  return usableProductAd(value, now, "mart", MART_PRODUCT_AD_SLOT);
}

export function usableFeedProductAd(value: ProductAd | null | undefined, now: number): value is ProductAd {
  return usableProductAd(value, now, "feed", FEED_PRODUCT_AD_SLOT);
}

export function usableSearchProductAd(value: ProductAd | null | undefined, now: number): value is ProductAd {
  return usableProductAd(value, now, "search", SEARCH_PRODUCT_AD_SLOT);
}

function usableProductAd(value: ProductAd | null | undefined, now: number, placement: ProductAdPlacement, slotKind: ProductAdSlot): value is ProductAd {
  if (!value || value.placement !== placement || value.slotKind !== slotKind || value.format !== "product" || value.creative?.format !== "product") return false;
  if (typeof value.adId !== "string" || !/^[A-Za-z0-9_:-]{1,128}$/.test(value.adId) || typeof value.impressionToken !== "string" || value.impressionToken.length < 8) return false;
  if ((value.label !== "Ad" && value.label !== "Sponsored") || value.creative.destination?.type !== "product" || typeof value.creative.destination.targetId !== "string" || !/^[A-Za-z0-9_:-]{1,128}$/.test(value.creative.destination.targetId)) return false;
  if (typeof value.creative.headline !== "string" || !value.creative.headline.trim() || typeof value.creative.identity?.name !== "string" || !value.creative.identity.name.trim()) return false;
  if (typeof value.creative.identity.handle !== "string" || !Array.isArray(value.creative.media) || !value.creative.media.length) return false;
  const expiresAt = Date.parse(value.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now && value.creative.media.some((media) => media?.kind === "image" && typeof media.url === "string" && /^https:\/\//i.test(media.url));
}

export const productAdsService = {
  decideMartProductAd: async () => {
    const decision = await api.post<ProductAdDecision>("/api/v1/ads/decide", {
      slot: { kind: MART_PRODUCT_AD_SLOT },
      sessionId: adSessionId,
    });
    return { ...decision, receivedAt: Date.now() };
  },
  decideFeedProductAd: async (contentId: ID, neighbourContentIds: readonly ID[], sessionId: string) => {
    const decision = await api.post<ProductAdDecision>("/api/v1/ads/decide", {
      slot: {
        kind: FEED_PRODUCT_AD_SLOT,
        contentId,
        neighbourContentIds: neighbourContentIds.slice(0, 10),
        slotsSinceLastAd: FEED_PRODUCT_AD_SLOT_INDEX,
        slotIndex: FEED_PRODUCT_AD_SLOT_INDEX,
      },
      sessionId,
    });
    return { ...decision, receivedAt: Date.now() };
  },
  decideSearchProductAd: async () => {
    const decision = await api.post<ProductAdDecision>("/api/v1/ads/decide", {
      slot: { kind: SEARCH_PRODUCT_AD_SLOT },
      sessionId: adSessionId,
    });
    return { ...decision, receivedAt: Date.now() };
  },
};
