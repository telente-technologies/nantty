import type { supportedCurrencyCodes } from "@/constants/currency.constant";

export type CurrencyCode = (typeof supportedCurrencyCodes)[number];

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}
