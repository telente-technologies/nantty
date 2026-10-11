import type { Money } from "./money.type";

export type CatalogProductStatus = "draft" | "active" | "archived";
export type ProductBrandRelationship = "own" | "authorised_reseller" | "genuine_resale";

export interface CatalogProductImage {
  readonly mediaId: string;
  readonly url: string;
}

export interface CatalogProductOption {
  readonly name: string;
  readonly values: readonly string[];
}

export interface CatalogStockLevel {
  readonly locationId: string;
  readonly onHand: number;
  readonly reserved: number;
}

export interface CatalogProductVariant {
  readonly id: string;
  readonly title: string;
  readonly optionValues: Readonly<Record<string, string>>;
  readonly sku: string;
  readonly barcode: string | null;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly costPrice: Money | null;
  readonly lowStockThreshold: number;
  readonly stock: readonly CatalogStockLevel[];
}

export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly status: CatalogProductStatus;
  readonly publishedOnline: boolean;
  readonly images: readonly CatalogProductImage[];
  readonly options: readonly CatalogProductOption[];
  readonly variants: readonly CatalogProductVariant[];
  readonly taxable: boolean;
  readonly trackInventory: boolean;
  readonly tags: readonly string[];
  readonly brand?: { readonly brandId: string; readonly name?: string; readonly relationship: ProductBrandRelationship } | null;
}

export interface CatalogVariantUpsertRequest {
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

export interface CatalogProductUpsertRequest {
  readonly name: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly status: CatalogProductStatus;
  readonly taxable: boolean;
  readonly trackInventory: boolean;
  readonly publishedOnline: boolean;
  readonly tags: string[];
  readonly options: { readonly name: string; readonly values: string[] }[];
  readonly imageMediaIds: string[];
  readonly variants: CatalogVariantUpsertRequest[];
  readonly brand?: { readonly brandId: string; readonly relationship: ProductBrandRelationship } | null;
}

export interface StoreLocation {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly active: boolean;
}
