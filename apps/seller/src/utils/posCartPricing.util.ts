import type { CurrencyCode } from "@/types/money.type";
import type { DiscountInput } from "@/types/pos.type";
import type { TaxRate } from "@/types/store.type";
import {
  allocateMinorAmountProportionally,
  calculateBasisPointsShareOfMinorAmount,
  calculateExclusiveTaxMinor,
  calculateTaxIncludedInGrossMinor,
} from "@/utils/money.util";

export interface CartPricingLineInput {
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly taxable: boolean;
  readonly categoryId: string | null;
  readonly discount: DiscountInput | null;
}

export interface CartPricingInput {
  readonly currency: CurrencyCode;
  readonly lines: readonly CartPricingLineInput[];
  readonly cartDiscount: DiscountInput | null;
  readonly couponDiscount: { readonly kind: "percent" | "amount"; readonly value: number } | null;
  readonly loyaltyRedemptionMinor: number;
  readonly taxes: readonly TaxRate[];
  readonly pricesIncludeTax: boolean;
}

export interface PricedCartLine {
  readonly grossMinor: number;
  readonly lineDiscountMinor: number;
  readonly cartDiscountShareMinor: number;
  readonly taxMinor: number;
  readonly totalMinor: number;
  readonly taxRateBasisPoints: number;
}

export interface PricedCart {
  readonly currency: CurrencyCode;
  readonly lines: PricedCartLine[];
  readonly subtotalMinor: number;
  readonly lineDiscountTotalMinor: number;
  readonly cartDiscountMinor: number;
  readonly couponDiscountMinor: number;
  readonly loyaltyRedemptionMinor: number;
  readonly discountTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly totalMinor: number;
  readonly itemsCount: number;
}

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

export function doesDiscountNeedManagerApproval(discountMinor: number, grossMinor: number, thresholdBasisPoints: number): boolean {
  if (discountMinor <= 0 || grossMinor <= 0) return false;
  return discountMinor * 10_000 > grossMinor * thresholdBasisPoints;
}

export function calculateCartTotalsInMinorUnits(input: CartPricingInput): PricedCart {
  const grossAmounts = input.lines.map((line) => line.unitPriceMinor * line.quantity);
  const lineDiscounts = input.lines.map((line, index) => calculateDiscountAmountMinor(grossAmounts[index] ?? 0, line.discount));
  const afterLineDiscounts = grossAmounts.map((gross, index) => gross - (lineDiscounts[index] ?? 0));
  const amountAfterLineDiscounts = afterLineDiscounts.reduce((sum, amount) => sum + amount, 0);

  const cartDiscountMinor = calculateDiscountAmountMinor(amountAfterLineDiscounts, input.cartDiscount);
  const couponDiscountMinor = calculateDiscountAmountMinor(amountAfterLineDiscounts - cartDiscountMinor, input.couponDiscount);
  const loyaltyRedemptionMinor = Math.max(0, Math.min(input.loyaltyRedemptionMinor, amountAfterLineDiscounts - cartDiscountMinor - couponDiscountMinor));
  const cartLevelDiscountMinor = cartDiscountMinor + couponDiscountMinor + loyaltyRedemptionMinor;
  const cartDiscountShares = allocateMinorAmountProportionally(cartLevelDiscountMinor, afterLineDiscounts);

  const pricedLines = input.lines.map((line, index): PricedCartLine => {
    const netAmountMinor = (afterLineDiscounts[index] ?? 0) - (cartDiscountShares[index] ?? 0);
    const taxRateBasisPoints = line.taxable ? findTaxRateBasisPointsForCategory(input.taxes, line.categoryId) : 0;
    const taxMinor = input.pricesIncludeTax
      ? calculateTaxIncludedInGrossMinor(netAmountMinor, taxRateBasisPoints)
      : calculateExclusiveTaxMinor(netAmountMinor, taxRateBasisPoints);
    return {
      grossMinor: grossAmounts[index] ?? 0,
      lineDiscountMinor: lineDiscounts[index] ?? 0,
      cartDiscountShareMinor: cartDiscountShares[index] ?? 0,
      taxMinor,
      totalMinor: input.pricesIncludeTax ? netAmountMinor : netAmountMinor + taxMinor,
      taxRateBasisPoints,
    };
  });

  const lineDiscountTotalMinor = lineDiscounts.reduce((sum, amount) => sum + amount, 0);
  return {
    currency: input.currency,
    lines: pricedLines,
    subtotalMinor: grossAmounts.reduce((sum, amount) => sum + amount, 0),
    lineDiscountTotalMinor,
    cartDiscountMinor,
    couponDiscountMinor,
    loyaltyRedemptionMinor,
    discountTotalMinor: lineDiscountTotalMinor + cartLevelDiscountMinor,
    taxTotalMinor: pricedLines.reduce((sum, line) => sum + line.taxMinor, 0),
    totalMinor: pricedLines.reduce((sum, line) => sum + line.totalMinor, 0),
    itemsCount: input.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function calculateCashChangeDueMinor(totalDueMinor: number, tenderedCashMinor: number, otherPaymentsMinor: number): number {
  return Math.max(0, tenderedCashMinor + otherPaymentsMinor - totalDueMinor);
}
