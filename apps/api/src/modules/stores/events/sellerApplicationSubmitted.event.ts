import { defineEvent } from "@zudojs/events";

export interface SellerApplicationSubmittedPayload {
  readonly applicationId: string;
  readonly userId: string;
}

export const SellerApplicationSubmittedEvent = defineEvent<"stores.sellerApplicationSubmitted", SellerApplicationSubmittedPayload>(
  "stores.sellerApplicationSubmitted",
);
