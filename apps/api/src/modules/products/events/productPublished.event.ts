import { defineEvent } from "@zudojs/events";

export interface ProductPublishedPayload {
  readonly productId: string;
  readonly storeId: string;
  readonly published: boolean;
}

export const ProductPublishedEvent = defineEvent<"products.productPublished", ProductPublishedPayload>("products.productPublished");
