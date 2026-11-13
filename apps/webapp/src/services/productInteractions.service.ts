import type { ConsentChoice } from "@nantty/web-kit";
import type { ProductInteractionEvent, ProductInteractionPayload, ProductInteractionRecord } from "@/types/privacy.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export function canRecordProductInteraction(isSignedIn: boolean, consent: ConsentChoice | null): boolean {
  return isSignedIn || consent?.categories.analytics === true;
}

export const productInteractionsService = {
  track(event: ProductInteractionEvent, payload: ProductInteractionPayload, isSignedIn: boolean, consent: ConsentChoice | null): void {
    if (!canRecordProductInteraction(isSignedIn, consent)) return;
    const interactionConsent = isSignedIn ? undefined : {
      analytics: true,
      personalization: consent?.categories.personalization === true,
    };
    void sendRequestToWebappServer<{ readonly accepted: number; readonly dropped: number }>("/api/v1/analytics/product-interactions", {
      method: "POST",
      body: { events: [{ event, payload, occurredAt: new Date().toISOString() } satisfies ProductInteractionRecord] },
      interactionConsent,
    }).catch(() => undefined);
  },
};
