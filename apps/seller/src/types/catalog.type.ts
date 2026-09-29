import type { ProductBrandTag } from "@/types/brand.type";
import type { Money } from "@/types/money.type";

export type ProductStatus = "draft" | "active" | "archived";

export interface ProductImage {
  readonly mediaId: string;
  readonly url: string;
}

export interface ProductOption {
  readonly name: string;
  readonly values: string[];
}

export interface StockLevel {
  readonly locationId: string;
  readonly onHand: number;
  readonly reserved: number;
}

export interface ProductVariant {
  readonly id: string;
  readonly productId: string;
  readonly title: string;
  readonly optionValues: Record<string, string>;
  readonly sku: string;
  readonly barcode: string | null;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly costPrice: Money | null;
  readonly lowStockThreshold: number;
  readonly stock: StockLevel[];
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly status: ProductStatus;
  readonly publishedOnline: boolean;
  readonly images: ProductImage[];
  readonly options: ProductOption[];
  readonly variants: ProductVariant[];
  readonly taxable: boolean;
  readonly trackInventory: boolean;
  readonly tags: string[];
  readonly brand?: ProductBrandTag | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductCategory {
  readonly id: string;
  readonly name: string;
}

export type StockAdjustmentReason = "received" | "count" | "damaged" | "theft" | "returned" | "expired" | "other";

export interface StockAdjustment {
  readonly id: string;
  readonly variantId: string;
  readonly productName: string;
  readonly variantTitle: string;
  readonly locationId: string;
  readonly quantityDelta: number;
  readonly reason: StockAdjustmentReason;
  readonly note: string | null;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
}

export type StockTransferStatus = "in_transit" | "received" | "cancelled";

export interface StockTransfer {
  readonly id: string;
  readonly reference: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly status: StockTransferStatus;
  readonly lines: { readonly variantId: string; readonly productName: string; readonly variantTitle: string; readonly quantity: number }[];
  readonly note: string | null;
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
  readonly receivedAt: string | null;
}
