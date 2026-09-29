import { defineEvent } from "@zudojs/events";

export interface ProductUpdatedPayload {
  readonly productId: string;
  readonly storeId: string;
}

export const ProductUpdatedEvent = defineEvent<"products.productUpdated", ProductUpdatedPayload>("products.productUpdated");
