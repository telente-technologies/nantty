import type { VisitorLocale } from "@/types/visitorLocale.types";

import { fallbackCurrencyCode } from "./currencyFormatting.util";

// Used only by the opt-in static prelaunch build. It deliberately performs no
// locale lookup; the existing UI keeps its neutral fallback presentation.
export const fallbackVisitorLocale: VisitorLocale = {
  countryCode: null,
  currency: fallbackCurrencyCode,
  isCountrySupported: false,
};

export async function fetchVisitorLocaleFromApi(): Promise<VisitorLocale> {
  return fallbackVisitorLocale;
}
