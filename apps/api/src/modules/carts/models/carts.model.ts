import type { SaleAttributionSource } from "../../../interfaces/orderLookup.interface.js";

export interface SaleAttribution {
  readonly source: SaleAttributionSource;
  readonly id: string;
}

export interface CartItemRecord {
  readonly id: string;
  readonly userId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly attributionSource: SaleAttributionSource | null;
  readonly attributionId: string | null;
  readonly createdAt: Date;
}

export const SALE_ATTRIBUTION_SOURCES = ["post", "clip", "live"] as const;

export const MAXIMUM_CART_LINE_QUANTITY = 99;
