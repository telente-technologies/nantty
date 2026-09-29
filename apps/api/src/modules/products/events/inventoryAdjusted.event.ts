import { defineEvent } from "@zudojs/events";

export interface InventoryAdjustedPayload {
  readonly productId: string;
  readonly variantId: string;
  readonly stock: number;
}

export const InventoryAdjustedEvent = defineEvent<"products.inventoryAdjusted", InventoryAdjustedPayload>("products.inventoryAdjusted");
