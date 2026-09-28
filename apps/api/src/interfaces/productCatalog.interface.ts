import type { Kobo } from "../types/money.type.js";

export interface PurchasableVariant {
  readonly variantId: string;
  readonly productId: string;
  readonly storeId: string;
  readonly title: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly imageUrl: string | null;
  readonly unitPrice: Kobo;
  readonly currency: string;
  readonly stock: number;
  readonly purchasable: boolean;
}

export interface ProductSummary {
  readonly id: string;
  readonly storeId: string;
  readonly title: string;
  readonly price: Kobo;
  readonly compareAtPrice: Kobo | null;
  readonly imageUrl: string | null;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly published: boolean;
}

export interface InventoryLine {
  readonly productId: string;
  readonly variantId: string;
  readonly title: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly stock: number;
}

export interface StockLine {
  readonly variantId: string;
  readonly quantity: number;
}

export interface ProductCatalog {
  findPurchasableVariants(variantIds: readonly string[]): Promise<readonly PurchasableVariant[]>;
  reserveStock(lines: readonly StockLine[]): Promise<void>;
  releaseStock(lines: readonly StockLine[]): Promise<void>;
  recordSales(lines: readonly { readonly productId: string; readonly quantity: number }[]): Promise<void>;
  findProductSummaries(productIds: readonly string[]): Promise<readonly ProductSummary[]>;
  listInventoryForStore(storeId: string): Promise<readonly InventoryLine[]>;
  updateProductRating(productId: string, ratingAverage: number, ratingCount: number): Promise<void>;
}
