import { defineEvent } from "@zudojs/events";

export interface ReviewCreatedPayload {
  readonly reviewId: string;
  readonly productId: string;
  readonly storeId: string;
  readonly rating: number;
}

export const ReviewCreatedEvent = defineEvent<"reviews.reviewCreated", ReviewCreatedPayload>("reviews.reviewCreated");
