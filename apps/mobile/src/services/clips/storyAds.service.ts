import { createSecureRandomHex } from "@/utils/secureRandomId.util";
import type { ID } from "@/types";
import type { StoryAdDecision } from "@/types/social.type";

import { api } from "../core/apiClient.service";

const adSessionId = `story_ads_${Date.now().toString(36)}_${createSecureRandomHex(6)}`;

export const STORY_AD_SLOT_KIND = "story";

export const storyAdsService = {
  decideStoryAd: (contentId: ID, slotsSinceLastAd: number, neighbourContentIds: readonly ID[], slotIndex: number) =>
    api.post<StoryAdDecision>("/api/v1/ads/decide", {
      slot: { kind: STORY_AD_SLOT_KIND, contentId, slotsSinceLastAd, neighbourContentIds: neighbourContentIds.slice(0, 10), slotIndex },
      sessionId: adSessionId,
    }),
  recordStoryAdImpression: (ad: { readonly adId: ID; readonly impressionToken: string }) =>
    api.post<void>("/api/v1/ads/events", {
      events: [{ campaignId: ad.adId, placement: "stories", type: "impression", itemId: ad.adId, token: ad.impressionToken }],
    }).catch(() => undefined),
  recordStoryAdClick: (ad: { readonly adId: ID; readonly impressionToken: string }) =>
    api.post<void>("/api/v1/ads/events", {
      events: [{ campaignId: ad.adId, placement: "stories", type: "click", itemId: ad.adId, token: ad.impressionToken }],
    }).catch(() => undefined),
};
