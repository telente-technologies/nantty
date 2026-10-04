import type { SponsoredPlacement } from "@/types";
import type { ThreadDecidedAd } from "@/types/postThread.type";

const CTA_LABELS: Record<string, string> = {
  shop_now: "Shop now",
  learn_more: "Learn more",
  visit_store: "Visit store",
  send_message: "Send message",
  follow: "Follow",
  watch_more: "Watch more",
  order_now: "Order now",
  sign_up: "Sign up",
  install: "Install",
  download: "Download",
  book_now: "Book now",
  contact_us: "Contact us",
};

export const labelForCallToAction = (code: string | undefined, fallback = "Learn more"): string => (code ? (CTA_LABELS[code] ?? code) : fallback);

export function sponsoredPlacementFromDecidedAd(ad: ThreadDecidedAd): SponsoredPlacement {
  const { creative } = ad;
  return {
    campaignId: ad.adId,
    label: ad.label,
    advertiserName: creative.identity.name,
    ctaLabel: labelForCallToAction(creative.callToAction),
    ctaUrl: creative.destination.url ?? undefined,
    adType: creative.type ?? "single",
    impressionToken: ad.impressionToken,
    clickLinks: ad.clickLinks,
    destination: creative.destination,
    mediaClickable: creative.mediaClickable,
    app: creative.app ?? undefined,
    cards: creative.cards?.map((card) => ({
      media: { kind: card.media.kind, url: card.media.url, posterUrl: card.media.posterUrl, width: card.media.width, height: card.media.height },
      headline: card.headline,
      description: card.description,
      ctaLabel: labelForCallToAction(card.callToAction),
      destination: card.destination,
    })),
  };
}
