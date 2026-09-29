import type { CurrencyCode, Money } from "@/types";
import { useLocaleStore } from "@/store/locale.store";

import { createMockRoute, type MockRoute } from "./registry.mock";

const CURRENCY_BY_COUNTRY: Record<string, CurrencyCode> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", GB: "GBP",
  DE: "EUR", FR: "EUR", IE: "EUR", NL: "EUR", ES: "EUR", IT: "EUR", US: "USD",
};

const UNITS_PER_US_DOLLAR: Record<CurrencyCode, number> = {
  USD: 1, NGN: 1550, GHS: 15.5, KES: 129, ZAR: 18.2, GBP: 0.79, EUR: 0.92,
};

export function convertUsdCentsToViewerCurrency(usdCents: number): Money {
  const currency = useLocaleStore.getState().currency;
  return { amountMinor: Math.round(usdCents * UNITS_PER_US_DOLLAR[currency]), currency };
}

export const localeMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/locale", () => {
    const countryCode = useLocaleStore.getState().deviceRegionCode;
    const currency = countryCode ? CURRENCY_BY_COUNTRY[countryCode] : undefined;
    return { countryCode, currency: currency ?? "USD", isCountrySupported: currency !== undefined };
  }),
];
