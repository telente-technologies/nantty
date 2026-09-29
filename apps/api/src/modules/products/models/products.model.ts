import type { CurrencyCode } from "../../../enums/currency.enum.js";

export type ProductStatus = "draft" | "published" | "archived";
export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular";

export interface ProductRecord {
  readonly id: string;
  readonly storeId: string;
  readonly categoryId: string | null;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly status: ProductStatus;
  readonly price: number;
  readonly compareAtPrice: number | null;
  readonly currency: CurrencyCode;
  readonly images: readonly string[];
  readonly shippingInfo: string;
  readonly returnsInfo: string;
  readonly featured: boolean;
  readonly salesCount: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewProductInput = Pick<
  ProductRecord,
  "storeId" | "categoryId" | "title" | "slug" | "description" | "price" | "compareAtPrice" | "currency" | "images" | "shippingInfo" | "returnsInfo"
>;

export type ProductChanges = Partial<
  Pick<ProductRecord, "categoryId" | "title" | "description" | "price" | "compareAtPrice" | "images" | "shippingInfo" | "returnsInfo">
>;

export interface ProductVariantRecord {
  readonly id: string;
  readonly productId: string;
  readonly sku: string | null;
  readonly size: string | null;
  readonly color: string | null;
  readonly price: number;
  readonly stock: number;
  readonly createdAt: Date;
}

export type NewVariantInput = Pick<ProductVariantRecord, "sku" | "size" | "color" | "price" | "stock">;
export type VariantChanges = Partial<Pick<ProductVariantRecord, "sku" | "size" | "color" | "price">>;

export interface PriceRange {
  readonly currency: CurrencyCode;
  readonly minPrice?: number;
  readonly maxPrice?: number;
}

export interface PublicProductFilter {
  readonly categoryId?: string;
  readonly storeId?: string;
  readonly search?: string;
  readonly priceRanges?: readonly PriceRange[];
  readonly sort: ProductSort;
  readonly excludedStoreIds: readonly string[];
}

export interface ProductWithVariants {
  readonly product: ProductRecord;
  readonly variants: readonly ProductVariantRecord[];
}

export function compareProductsBySort(sort: ProductSort): (left: ProductRecord, right: ProductRecord) => number {
  const newest = (left: ProductRecord, right: ProductRecord) =>
    right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
  if (sort === "price_asc") return (left, right) => left.price - right.price || left.id.localeCompare(right.id);
  if (sort === "price_desc") return (left, right) => right.price - left.price || right.id.localeCompare(left.id);
  if (sort === "popular") return (left, right) => right.salesCount - left.salesCount || newest(left, right);
  return newest;
}

export function calculateDiscountFraction(product: ProductRecord): number {
  if (product.compareAtPrice === null || product.compareAtPrice <= product.price || product.compareAtPrice === 0) return 0;
  return (product.compareAtPrice - product.price) / product.compareAtPrice;
}

export interface VariantOfProduct {
  readonly product: ProductRecord;
  readonly variant: ProductVariantRecord;
}
