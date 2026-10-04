import type { ProductBrandRelationship } from "@/types/brand.type";
import type { CurrencyCode, Money } from "@/types/money.type";
import type { ProductAttribute, ProductOption, ProductStatus, ProductVisibility, StockAdjustmentReason } from "@/types/catalog.type";

export interface RegionalPriceRequest {
  readonly currency: CurrencyCode;
  readonly priceMinor: number;
}

export interface ProductVariantUpsertRequest {
  readonly id: string | null;
  readonly optionValues: Record<string, string>;
  readonly sku: string;
  readonly barcode: string | null;
  readonly priceMinor: number;
  readonly compareAtPriceMinor: number | null;
  readonly costPriceMinor: number | null;
  readonly regionalPrices?: readonly RegionalPriceRequest[];
  readonly lowStockThreshold: number;
  readonly reorderPoint?: number;
  readonly reorderQuantity?: number;
  readonly openingStock: { readonly locationId: string; readonly quantity: number }[];
}

export interface ProductUpsertRequest {
  readonly name: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly status: ProductStatus;
  readonly taxable: boolean;
  readonly trackInventory: boolean;
  readonly publishedOnline: boolean;
  readonly tags: string[];
  readonly options: ProductOption[];
  readonly imageMediaIds: string[];
  readonly variants: ProductVariantUpsertRequest[];
  readonly brand?: { readonly brandId: string; readonly relationship: ProductBrandRelationship } | null;
  readonly visibility?: ProductVisibility;
  readonly publishAt?: string | null;
  readonly attributes?: ProductAttribute[];
  readonly videos?: { readonly url: string; readonly title: string }[];
  readonly supplierId?: string | null;
}

export type ProductBulkAction = "publish" | "unpublish" | "archive" | "set_category" | "set_visibility" | "change_price_percent";

export interface ProductBulkActionRequest {
  readonly action: ProductBulkAction;
  readonly productIds: string[];
  readonly categoryId?: string | null;
  readonly visibility?: ProductVisibility;
  readonly pricePercentBasisPoints?: number;
}

export interface ProductBulkActionResult {
  readonly updatedProductIds: string[];
}

export interface ProductImportRow {
  readonly rowNumber: number;
  readonly productName: string;
  readonly description: string;
  readonly categoryName: string;
  readonly option1Name: string;
  readonly option1Value: string;
  readonly option2Name: string;
  readonly option2Value: string;
  readonly sku: string;
  readonly barcode: string;
  readonly price: string;
  readonly compareAtPrice: string;
  readonly costPrice: string;
  readonly lowStockThreshold: string;
  readonly openingStock: string;
  readonly taxable: string;
  readonly publishedOnline: string;
}

export interface ProductImportRequest {
  readonly locationId: string;
  readonly rows: ProductImportRow[];
}

export interface ProductImportResult {
  readonly created: number;
  readonly updated: number;
  readonly failed: { readonly row: number; readonly message: string }[];
}

export interface InventoryLevelRow {
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  readonly locationId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly lowStockThreshold: number;
  readonly costPrice: Money | null;
  readonly stockValue: Money | null;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
}

export interface StockAdjustmentRequest {
  readonly locationId: string;
  readonly lines: { readonly variantId: string; readonly quantityDelta: number }[];
  readonly reason: StockAdjustmentReason;
  readonly note: string | null;
}

export interface StockTransferRequest {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly lines: { readonly variantId: string; readonly quantity: number }[];
  readonly note: string | null;
}

export interface MediaUploadSession {
  readonly uploadId: string;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: number[];
}

export interface MediaRecord {
  readonly mediaId: string;
  readonly status: "processing" | "ready" | "failed";
  readonly url: string | null;
  readonly mimeType: string;
}

export interface ProductUsageSummary {
  readonly activeProducts: number;
  readonly draftProducts: number;
  readonly scheduledProducts: number;
  readonly archivedProducts: number;
  readonly maxActiveProducts: number | null;
}

export interface InventorySummary {
  readonly locationId: string | null;
  readonly skuCount: number;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
  readonly needsReorderCount: number;
  readonly stockValue: Money;
  readonly retailValue: Money;
}

export interface InventoryLocationSummary {
  readonly locationId: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
  readonly city: string;
  readonly isDefault: boolean;
  readonly active: boolean;
  readonly skuCount: number;
  readonly onHand: number;
  readonly reserved: number;
  readonly lowStockCount: number;
  readonly stockValue: Money;
}

export interface ReorderSuggestionRow {
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly locationId: string;
  readonly available: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
  readonly suggestedQuantity: number;
  readonly supplier: { readonly id: string; readonly name: string; readonly leadTimeDays: number } | null;
  readonly estimatedCost: Money | null;
}

export interface ReorderLevelUpdateRequest {
  readonly variantId: string;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
}

export interface SupplierUpsertRequest {
  readonly name: string;
  readonly contactName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string;
  readonly leadTimeDays: number;
  readonly paymentTerms: string;
  readonly notes: string | null;
}

export interface CategoryUpsertRequest {
  readonly name: string;
  readonly description: string;
}
