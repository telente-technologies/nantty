import { CurrencyCode } from "../enums/currency.enum.js";
import { PaymentProvider } from "../enums/paymentStatus.enum.js";

export const FALLBACK_CURRENCY_CODE: CurrencyCode = CurrencyCode.USD;

export const EUROZONE_COUNTRY_CODES: readonly string[] = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
];

export const COUNTRY_CURRENCY_CODES: Readonly<Record<string, CurrencyCode>> = {
  NG: CurrencyCode.NGN,
  GH: CurrencyCode.GHS,
  KE: CurrencyCode.KES,
  ZA: CurrencyCode.ZAR,
  GB: CurrencyCode.GBP,
  US: CurrencyCode.USD,
  ...Object.fromEntries(EUROZONE_COUNTRY_CODES.map((countryCode) => [countryCode, CurrencyCode.EUR])),
};

export const CURRENCY_MINOR_UNIT_DIGITS: Readonly<Record<CurrencyCode, number>> = {
  NGN: 2, GHS: 2, KES: 2, ZAR: 2, GBP: 2, EUR: 2, USD: 2,
};

export const PAYMENT_PROVIDER_CURRENCY_CODES: Readonly<Record<PaymentProvider, readonly CurrencyCode[]>> = {
  [PaymentProvider.PAYSTACK]: [CurrencyCode.NGN, CurrencyCode.GHS, CurrencyCode.ZAR, CurrencyCode.KES, CurrencyCode.USD],
  [PaymentProvider.FLUTTERWAVE]: [
    CurrencyCode.NGN, CurrencyCode.GHS, CurrencyCode.KES, CurrencyCode.ZAR, CurrencyCode.USD, CurrencyCode.GBP, CurrencyCode.EUR,
  ],
};

export const CHECKOUT_CHARGE_CURRENCY_CODES: readonly CurrencyCode[] = PAYMENT_PROVIDER_CURRENCY_CODES[PaymentProvider.PAYSTACK].filter(
  (currency) => PAYMENT_PROVIDER_CURRENCY_CODES[PaymentProvider.FLUTTERWAVE].includes(currency),
);

export function normalizeCountryCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(trimmed) && trimmed !== "XX" && trimmed !== "T1" ? trimmed : null;
}

export function findCurrencyForCountry(countryCode: string | null): { readonly currency: CurrencyCode; readonly isCountrySupported: boolean } {
  const currency = countryCode === null ? undefined : COUNTRY_CURRENCY_CODES[countryCode];
  return currency === undefined ? { currency: FALLBACK_CURRENCY_CODE, isCountrySupported: false } : { currency, isCountrySupported: true };
}

export function chooseChargeCurrencyForDisplayCurrency(displayCurrency: CurrencyCode): CurrencyCode {
  return CHECKOUT_CHARGE_CURRENCY_CODES.includes(displayCurrency) ? displayCurrency : FALLBACK_CURRENCY_CODE;
}

export function providerSupportsCurrency(provider: PaymentProvider, currency: CurrencyCode): boolean {
  return PAYMENT_PROVIDER_CURRENCY_CODES[provider].includes(currency);
}
