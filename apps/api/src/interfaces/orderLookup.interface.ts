import type { CurrencyCode } from "../enums/currency.enum.js";
import type { MinorUnits } from "../types/money.type.js";

export type SaleAttributionSource = "post" | "clip" | "live";

export interface AttributedOrderItem {
  readonly orderId: string;
  readonly storeId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly lineTotal: MinorUnits;
  readonly currency: CurrencyCode;
  readonly attributionSource: SaleAttributionSource | null;
  readonly attributionId: string | null;
}

export interface OrderLookup {
  hasReceivedProductInOrder(buyerId: string, orderId: string, productId: string): Promise<{ readonly storeId: string } | undefined>;
  findReceivedOrderForProduct(buyerId: string, productId: string): Promise<{ readonly orderId: string; readonly storeId: string } | undefined>;
  listStoreIdsBuyerHasPurchasedFrom(buyerId: string): Promise<readonly string[]>;
  listAttributedOrderItems(orderId: string): Promise<readonly AttributedOrderItem[]>;
}
