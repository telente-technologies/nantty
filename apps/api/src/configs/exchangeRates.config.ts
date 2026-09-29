import type { CurrencyCode } from "../enums/currency.enum.js";

export const STATIC_UNITS_PER_US_DOLLAR: Readonly<Record<CurrencyCode, string>> = {
  USD: "1",
  NGN: "1550",
  GHS: "15.4",
  KES: "129.5",
  ZAR: "18.1",
  GBP: "0.78",
  EUR: "0.91",
};
