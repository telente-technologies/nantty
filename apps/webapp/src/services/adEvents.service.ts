import type { AdEvent, AdPlacement, ID, SponsoredPlacement } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

const recordedThisSession = new Set<string>();

const sendAdEvent = (event: AdEvent) =>
  sendRequestToWebappServer<void>("/api/v1/ads/events", { method: "POST", body: { events: [{ ...event, occurredAt: new Date().toISOString() }] } }).catch(() => undefined);

export const adEventsService = {
  recordImpressionOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID) => {
    const key = `${sponsored.campaignId}:${placement}:${itemId}`;
    if (recordedThisSession.has(key)) return;
    recordedThisSession.add(key);
    return sendAdEvent({ campaignId: sponsored.campaignId, placement, type: "impression", itemId, token: sponsored.impressionToken });
  },
  recordCardViewOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex: number) => {
    const key = `${sponsored.campaignId}:${placement}:${itemId}:card:${cardIndex}`;
    if (recordedThisSession.has(key)) return;
    recordedThisSession.add(key);
    return sendAdEvent({ campaignId: sponsored.campaignId, placement, type: "card_view", itemId, token: sponsored.impressionToken, cardIndex });
  },
  recordClick: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex?: number) =>
    sendAdEvent({ campaignId: sponsored.campaignId, placement, type: "click", itemId, token: sponsored.impressionToken, cardIndex }),
};
