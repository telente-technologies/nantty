import type { StatusTone } from "@/components/ui/statusBadge";
import type { Product, ProductStatus, ProductVariant, ProductVisibility } from "@/types/catalog.type";
import type { Money } from "@/types/money.type";
import { calculateMarginBasisPoints } from "@/utils/productValidation.util";

export const productStatusTone: Record<ProductStatus, StatusTone> = { active: "success", draft: "neutral", archived: "caution" };
export const productStatusLabel: Record<ProductStatus, string> = { active: "Active", draft: "Draft", archived: "Archived" };

export function findLowestAndHighestVariantPrice(product: Product): { lowest: Money | null; highest: Money | null } {
  const sortedPrices = product.variants.map((variant) => variant.price).sort((first, second) => first.amountMinor - second.amountMinor);
  return { lowest: sortedPrices[0] ?? null, highest: sortedPrices[sortedPrices.length - 1] ?? null };
}

export function sumVariantOnHand(variant: ProductVariant, locationId: string | null): number {
  return variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((sum, level) => sum + level.onHand, 0);
}

export function sumProductOnHand(product: Product, locationId: string | null): number {
  return product.variants.reduce((sum, variant) => sum + sumVariantOnHand(variant, locationId), 0);
}

export function calculateAverageProductMarginBasisPoints(product: Product): number | null {
  const margins = product.variants
    .map((variant) => calculateMarginBasisPoints(variant.price.amountMinor, variant.costPrice?.amountMinor ?? null))
    .filter((margin): margin is number => margin !== null);
  if (margins.length === 0) return null;
  return Math.round(margins.reduce((sum, margin) => sum + margin, 0) / margins.length);
}

export function isVariantLowOnStock(variant: ProductVariant, locationId: string | null): boolean {
  return sumVariantOnHand(variant, locationId) <= variant.lowStockThreshold;
}

export const productVisibilityLabel: Record<ProductVisibility, string> = { public: "Everyone", store_only: "Store page only", link_only: "Link only" };
export const productVisibilityDescription: Record<ProductVisibility, string> = {
  public: "Shows in Mart, search, feeds and your store page.",
  store_only: "Only shows on your store page in the app.",
  link_only: "Hidden from browsing. Only people with the link can buy it.",
};

export function describeProductPublicationState(product: Pick<Product, "status" | "publishAt">): { label: string; tone: StatusTone } {
  if (product.status === "draft" && product.publishAt) return { label: "Scheduled", tone: "info" };
  return { label: productStatusLabel[product.status], tone: productStatusTone[product.status] };
}

export function calculateCompareAtDiscountBasisPoints(variant: Pick<ProductVariant, "price" | "compareAtPrice">): number | null {
  if (!variant.compareAtPrice || variant.compareAtPrice.amountMinor <= variant.price.amountMinor) return null;
  return Math.round(((variant.compareAtPrice.amountMinor - variant.price.amountMinor) * 10_000) / variant.compareAtPrice.amountMinor);
}
