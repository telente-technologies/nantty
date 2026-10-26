import type { StoryAdDecision } from "@/types/social.type";

import { postImageUrlsForPhotoKey } from "./mockImages.mock";

interface StorySlotRequest {
  readonly kind?: string;
  readonly contentId?: string;
  readonly slotIndex?: number;
  readonly slotsSinceLastAd?: number;
}

const STORY_AD_MINIMUM_GAP = 4;
const AD_EXPIRY_MS = 15 * 60_000;

export const decideStoryAdMock = (slot: StorySlotRequest, viewerUserId: string | null): StoryAdDecision => {
  if (slot.kind !== "story") return { ad: null, declinedReason: "unknownSlotKind" };
  if ((slot.slotsSinceLastAd ?? 0) < STORY_AD_MINIMUM_GAP) return { ad: null, declinedReason: "frequencyCap" };
  const imageUrl = postImageUrlsForPhotoKey("lagosSkyline")[0] ?? "";
  return {
    ad: {
      adId: `ad_story_${slot.contentId ?? "story"}_${slot.slotIndex ?? 0}`,
      impressionToken: `imp_story_${Date.now().toString(36)}`,
      expiresAt: new Date(Date.now() + AD_EXPIRY_MS).toISOString(),
      placement: "stories",
      slotKind: "story",
      format: "image",
      label: "Sponsored",
      skipAfterSeconds: 3,
      creative: {
        media: [{ id: "md_ad_story_1", kind: "image", url: imageUrl, posterUrl: null, width: 1080, height: 1920 }],
        headline: "Mama Put Party Trays",
        primaryText: "Feeding 10 to 200 guests? Order same-day party trays.",
        callToAction: "Order now",
        destination: { type: "url", targetId: null, url: "https://nantty.com/stores/st_mama_put" },
        identity: { name: "Mama Put Kitchens", handle: "mamaputkitchens", avatarUrl: null },
      },
    },
  };
};
