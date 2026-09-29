import type { StatusTone } from "@/components/ui/statusBadge";
import type { Product, ProductStatus, ProductVariant } from "@/types/catalog.type";
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
