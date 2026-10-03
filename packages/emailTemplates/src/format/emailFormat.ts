import type { Money } from "../emailTypes";

const fractionDigitsCache = new Map<string, number>();

function readFractionDigits(currency: string): number {
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  fractionDigitsCache.set(currency, digits);
  return digits;
}

export function formatMoney(amount: Money, locale: string): string {
  const digits = readFractionDigits(amount.currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency: amount.currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount.amountMinor / 10 ** digits);
}

export function addMoney(...amounts: readonly Money[]): Money {
  const currency = amounts[0]?.currency ?? "NGN";
  if (amounts.some((amount) => amount.currency !== currency)) throw new Error("Cannot add amounts in different currencies.");
  return { currency, amountMinor: amounts.reduce((sum, amount) => sum + amount.amountMinor, 0) };
}

export function multiplyMoney(amount: Money, factor: number): Money {
  return { currency: amount.currency, amountMinor: Math.round(amount.amountMinor * factor) };
}

export function formatDate(iso: string, locale: string, timeZone = "Africa/Lagos"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string, timeZone = "Africa/Lagos"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" }).format(new Date(iso));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
