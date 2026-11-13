"use client";

import { useCallback } from "react";
import { useConsentChoice } from "@nantty/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { productInteractionsService } from "@/services/productInteractions.service";
import type { ProductInteractionEvent, ProductInteractionPayload } from "@/types/privacy.type";

export function useProductInteraction() {
  const { viewer } = useSession();
  const consent = useConsentChoice();
  const track = useCallback((event: ProductInteractionEvent, payload: ProductInteractionPayload = {}) => {
    productInteractionsService.track(event, payload, viewer !== null, consent);
  }, [consent, viewer]);
  return { track, canTrack: viewer !== null || consent?.categories.analytics === true, viewerId: viewer?.id ?? null };
}
