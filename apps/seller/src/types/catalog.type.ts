import type { ProductBrandTag } from "@/types/brand.type";
import type { CurrencyCode, Money } from "@/types/money.type";

export type ProductStatus = "draft" | "active" | "archived";
export type ProductVisibility = "public" | "store_only" | "link_only";

export interface ProductAttribute {
  readonly name: string;
  readonly value: string;
}

export interface ProductVideo {
  readonly id: string;
  readonly url: string;
  readonly title: string;
}

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
  readonly regionalPrices?: readonly { readonly currency: CurrencyCode; readonly priceMinor: number }[];
  readonly lowStockThreshold: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
  readonly weightGrams?: number | null;
  readonly lengthMm?: number | null;
  readonly widthMm?: number | null;
  readonly heightMm?: number | null;
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
  readonly visibility: ProductVisibility;
  readonly publishAt: string | null;
  readonly attributes: ProductAttribute[];
  readonly videos: ProductVideo[];
  readonly supplierId: string | null;
  readonly weightGrams?: number | null;
  readonly lengthMm?: number | null;
  readonly widthMm?: number | null;
  readonly heightMm?: number | null;
  readonly packageCategory?: string;
  readonly packageCount?: number;
  readonly fragile?: boolean;
  readonly contentsDescription?: string;
  readonly declaredValueMinor?: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductCategory {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly productCount?: number;
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

export interface Supplier {
  readonly id: string;
  readonly name: string;
  readonly contactName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string;
  readonly leadTimeDays: number;
  readonly paymentTerms: string;
  readonly notes: string | null;
  readonly productCount: number;
  readonly createdAt: string;
}

export type InventoryMovementKind = "adjustment" | "transfer_out" | "transfer_in" | "order_reserved" | "order_shipped" | "order_returned";

export interface InventoryMovement {
  readonly id: string;
  readonly kind: InventoryMovementKind;
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly locationId: string;
  readonly quantityDelta: number;
  readonly reference: string;
  readonly note: string | null;
  readonly actorName: string;
  readonly createdAt: string;
}
