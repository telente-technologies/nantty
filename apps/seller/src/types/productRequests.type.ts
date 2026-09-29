import type { Money } from "@/types/money.type";
import type { ProductOption, ProductStatus, StockAdjustmentReason } from "@/types/catalog.type";

export interface ProductVariantUpsertRequest {
  readonly id: string | null;
  readonly optionValues: Record<string, string>;
  readonly sku: string;
  readonly barcode: string | null;
  readonly priceMinor: number;
  readonly compareAtPriceMinor: number | null;
  readonly costPriceMinor: number | null;
  readonly lowStockThreshold: number;
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
}

export type ProductBulkAction = "publish" | "unpublish" | "archive";

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
