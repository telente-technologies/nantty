export const CurrencyCode = {
  NGN: "NGN",
  GHS: "GHS",
  KES: "KES",
  ZAR: "ZAR",
  GBP: "GBP",
  EUR: "EUR",
  USD: "USD",
} as const;
export type CurrencyCode = (typeof CurrencyCode)[keyof typeof CurrencyCode];

export const SUPPORTED_CURRENCY_CODES: readonly CurrencyCode[] = Object.values(CurrencyCode);

export function isSupportedCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(value);
}
