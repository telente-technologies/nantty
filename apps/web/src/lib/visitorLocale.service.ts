import type { VisitorLocale } from "@/types/visitorLocale.types";

import { readPublicApiBaseUrl } from "./apiClient.util";
import { fallbackCurrencyCode, isUsableCurrencyCode } from "./currencyFormatting.util";

const visitorLocaleApiPath = "/api/v1/locale";
const localeRequestTimeoutInMilliseconds = 4_000;

export const fallbackVisitorLocale: VisitorLocale = { countryCode: null, currency: fallbackCurrencyCode, isCountrySupported: false };

function convertApiBodyToVisitorLocale(responseBody: unknown): VisitorLocale {
  if (typeof responseBody !== "object" || responseBody === null) return fallbackVisitorLocale;
  const { countryCode, currency, isCountrySupported } = responseBody as Record<string, unknown>;
  const isSupported = isCountrySupported === true;
  return {
    countryCode: typeof countryCode === "string" && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
    currency: isSupported && isUsableCurrencyCode(currency) ? currency : fallbackCurrencyCode,
    isCountrySupported: isSupported,
  };
}

export async function fetchVisitorLocaleFromApi(): Promise<VisitorLocale> {
  const apiBaseUrl = readPublicApiBaseUrl();
  if (!apiBaseUrl) return fallbackVisitorLocale;
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), localeRequestTimeoutInMilliseconds);
  try {
    const response = await fetch(`${apiBaseUrl}${visitorLocaleApiPath}`, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: timeoutController.signal,
    });
    if (!response.ok) return fallbackVisitorLocale;
    return convertApiBodyToVisitorLocale(await response.json());
  } catch {
    return fallbackVisitorLocale;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
