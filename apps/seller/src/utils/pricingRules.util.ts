import type { TaxRate } from "@/types/store.type";
import { calculateBasisPointsShareOfMinorAmount } from "@/utils/money.util";

export function calculateDiscountAmountMinor(baseAmountMinor: number, discount: { readonly kind: "percent" | "amount"; readonly value: number } | null): number {
  if (!discount || baseAmountMinor <= 0) return 0;
  const rawDiscountMinor = discount.kind === "percent" ? calculateBasisPointsShareOfMinorAmount(baseAmountMinor, discount.value) : discount.value;
  return Math.max(0, Math.min(baseAmountMinor, Math.round(rawDiscountMinor)));
}

export function findTaxRateBasisPointsForCategory(taxes: readonly TaxRate[], categoryId: string | null): number {
  const categorySpecificRate = categoryId ? taxes.find((tax) => tax.appliesToCategoryIds?.includes(categoryId)) : undefined;
  if (categorySpecificRate) return categorySpecificRate.rateBasisPoints;
  return taxes.find((tax) => tax.isDefault)?.rateBasisPoints ?? 0;
}
