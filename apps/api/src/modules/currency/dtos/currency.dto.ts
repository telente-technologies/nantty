import type { LockedExchangeRate } from "../../../interfaces/currencyConverter.interface.js";
import type { ViewerLocale } from "../../../interfaces/viewerLocale.interface.js";

export function convertViewerLocaleToDto(locale: ViewerLocale) {
  return { countryCode: locale.countryCode, currency: locale.currency, isCountrySupported: locale.isCountrySupported };
}

export function convertExchangeRateToDto(rate: LockedExchangeRate) {
  return { currency: rate.sourceCurrency, displayCurrency: rate.targetCurrency, rate: rate.rateText, quotedAt: rate.quotedAt.toISOString() };
}
