export const supportedCurrencyCodes = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;

export const minorUnitsPerMajorUnitByCurrency: Record<(typeof supportedCurrencyCodes)[number], number> = {
  NGN: 100,
  GHS: 100,
  KES: 100,
  ZAR: 100,
  GBP: 100,
  EUR: 100,
  USD: 100,
};
