import { defineEvent } from "@zudojs/events";

import type { SellerOnboardingDetails } from "../models/stores.model.js";

export interface SellerApplicationReviewedPayload {
  readonly applicationId: string;
  readonly userId: string;
  readonly decision: "approve" | "reject";
  readonly storeId: string | null;
  readonly onboarding: SellerOnboardingDetails | null;
}

export const SellerApplicationReviewedEvent = defineEvent<"stores.sellerApplicationReviewed", SellerApplicationReviewedPayload>(
  "stores.sellerApplicationReviewed",
);
