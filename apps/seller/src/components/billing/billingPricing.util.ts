import type { BillingOffer } from "@/types/billingOffer.type";
import type { Money } from "@/types/money.type";

export interface DisplayedPrice {
  readonly price: Money;
  readonly listPrice: Money | null;
  readonly note: string | null;
}

export function computeDisplayedPrice(monthly: Money, interval: "month" | "year", offer: BillingOffer | null): DisplayedPrice {
  const hasBlue = offer?.bundle.hasActiveBlue ?? false;
  const bundlePercent = hasBlue ? offer?.bundle.discountPercent ?? 0 : 0;
  const yearlyPercent = offer?.yearlyDiscountPercent ?? 0;
  if (interval === "month") {
    if (bundlePercent === 0) return { price: monthly, listPrice: null, note: null };
    return { price: { ...monthly, amountMinor: Math.round(monthly.amountMinor * (1 - bundlePercent / 100)) }, listPrice: monthly, note: `Blue + Gold bundle −${bundlePercent}% applied because you have an active Blue checkmark.` };
  }
  const yearlyList = { ...monthly, amountMinor: monthly.amountMinor * 12 };
  const bestPercent = Math.max(yearlyPercent, bundlePercent);
  const note = bundlePercent === 0 ? `Yearly saves ${yearlyPercent}%.` : yearlyPercent >= bundlePercent ? `Yearly saving (${yearlyPercent}%) is bigger than the Blue + Gold bundle (${bundlePercent}%), so it applies instead. They do not stack.` : `The Blue + Gold bundle (${bundlePercent}%) beats the yearly saving (${yearlyPercent}%), so it applies instead. They do not stack.`;
  return { price: { ...monthly, amountMinor: Math.round(yearlyList.amountMinor * (1 - bestPercent / 100)) }, listPrice: yearlyList, note };
}
