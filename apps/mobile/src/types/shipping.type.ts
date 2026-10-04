import type { CartItem } from "./cartOrder.type";
import type { Money } from "./money.type";

export type ShippingQuoteStatus = "needsAddress" | "notDeliverable" | "calculated";

export interface ShippingQuote {
  readonly status: ShippingQuoteStatus;
  readonly fee: Money | null;
  readonly message: string | null;
  readonly isFree: boolean;
  readonly freeThreshold: Money | null;
  readonly amountToFreeShipping: Money | null;
}

export interface CartGroupStore {
  readonly verified?: boolean;
  readonly rating?: number;
  readonly ratingCount?: number;
  readonly successRate?: number | null;
}

export interface CartSellerGroup {
  readonly storeId: string;
  readonly storeName: string;
  readonly store?: CartGroupStore | null;
  readonly items: readonly CartItem[];
  readonly subtotal: Money;
  readonly discounts: Money;
  readonly storeCredit: Money;
  readonly shipping: ShippingQuote;
  readonly total: Money;
}
