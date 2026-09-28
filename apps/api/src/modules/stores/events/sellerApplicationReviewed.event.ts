import { defineEvent } from "@zudojs/events";

export interface SellerApplicationReviewedPayload {
  readonly applicationId: string;
  readonly userId: string;
  readonly decision: "approve" | "reject";
  readonly storeId: string | null;
}

export const SellerApplicationReviewedEvent = defineEvent<"stores.sellerApplicationReviewed", SellerApplicationReviewedPayload>(
  "stores.sellerApplicationReviewed",
);
