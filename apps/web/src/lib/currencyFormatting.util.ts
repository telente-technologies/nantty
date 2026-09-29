export const fallbackCurrencyCode = "USD";

export function isUsableCurrencyCode(candidateCurrencyCode: unknown): candidateCurrencyCode is string {
  if (typeof candidateCurrencyCode !== "string" || !/^[A-Z]{3}$/.test(candidateCurrencyCode)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: candidateCurrencyCode });
    return true;
  } catch {
    return false;
  }
}

export function readCurrencySymbolForDisplay(currencyCode: string, displayLocale?: string): string {
  const safeCurrencyCode = isUsableCurrencyCode(currencyCode) ? currencyCode : fallbackCurrencyCode;
  const currencyParts = new Intl.NumberFormat(displayLocale, { style: "currency", currency: safeCurrencyCode, currencyDisplay: "narrowSymbol" }).formatToParts(0);
  return currencyParts.find((currencyPart) => currencyPart.type === "currency")?.value ?? safeCurrencyCode;
}

export function readCurrencyDisplayName(currencyCode: string, displayLocale = "en"): string {
  const safeCurrencyCode = isUsableCurrencyCode(currencyCode) ? currencyCode : fallbackCurrencyCode;
  try {
    return new Intl.DisplayNames([displayLocale], { type: "currency" }).of(safeCurrencyCode) ?? safeCurrencyCode;
  } catch {
    return safeCurrencyCode;
  }
}

export function formatAmountInLocalCurrency(amountInMajorUnits: number, currencyCode: string, displayLocale?: string): string {
  const safeCurrencyCode = isUsableCurrencyCode(currencyCode) ? currencyCode : fallbackCurrencyCode;
  return new Intl.NumberFormat(displayLocale, { style: "currency", currency: safeCurrencyCode }).format(amountInMajorUnits);
}
