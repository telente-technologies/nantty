import type { CurrencyCode } from "@/types/money.type";
import { readMinorUnitsPerMajorUnit } from "@/utils/money.util";

export function buildQuickTenderAmountsMinor(amountDueMinor: number, currency: CurrencyCode, maximumSuggestions = 4): number[] {
  if (amountDueMinor <= 0) return [];
  const minorPerMajor = readMinorUnitsPerMajorUnit(currency);
  const majorMagnitude = Math.max(1, 10 ** Math.floor(Math.log10(Math.max(amountDueMinor / minorPerMajor, 1))));
  const stepSizesInMajor = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].map((multiplier) => multiplier * majorMagnitude).filter((step) => step >= 1);
  const suggestions = new Set<number>([amountDueMinor]);
  for (const stepInMajor of stepSizesInMajor) {
    const stepInMinor = Math.round(stepInMajor * minorPerMajor);
    const roundedUpMinor = Math.ceil(amountDueMinor / stepInMinor) * stepInMinor;
    if (roundedUpMinor > amountDueMinor) suggestions.add(roundedUpMinor);
    if (suggestions.size >= maximumSuggestions) break;
  }
  return [...suggestions].sort((first, second) => first - second).slice(0, maximumSuggestions);
}
