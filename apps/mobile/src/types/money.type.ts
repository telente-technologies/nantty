export type CurrencyCode = "NGN" | "GHS" | "KES" | "ZAR" | "GBP" | "EUR" | "USD";

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export interface ViewerLocale {
  readonly countryCode: string | null;
  readonly currency: CurrencyCode;
  readonly isCountrySupported: boolean;
}
