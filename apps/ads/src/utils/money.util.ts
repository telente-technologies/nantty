import { defaultDisplayLocale } from "@/constants/locale.constant";
import type { Money } from "@/types/money.type";

const fractionDigitsCache = new Map<string, number>();

export function readMinorUnitDigitsForCurrency(currency: string): number {
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  let digits: number;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  fractionDigitsCache.set(currency, digits);
  return digits;
}

export function convertMinorAmountToMajor(money: Money): number {
  return money.amountMinor / 10 ** readMinorUnitDigitsForCurrency(money.currency);
}

export function convertMajorAmountToMoney(majorAmount: number, currency: string): Money {
  return { amountMinor: Math.round(majorAmount * 10 ** readMinorUnitDigitsForCurrency(currency)), currency };
}

export function parseTypedMajorAmountToMoney(typedText: string, currency: string): Money | null {
  const cleaned = typedText.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{0,4})?$/.test(cleaned)) return null;
  return convertMajorAmountToMoney(Number(cleaned), currency);
}

export function formatMoneyForDisplay(money: Money | null | undefined, options: { readonly compact?: boolean; readonly showMinorUnits?: boolean } = {}): string {
  if (!money) return "—";
  const majorAmount = convertMinorAmountToMajor(money);
  const digits = readMinorUnitDigitsForCurrency(money.currency);
  try {
    return new Intl.NumberFormat(defaultDisplayLocale, {
      style: "currency",
      currency: money.currency,
      notation: options.compact ? "compact" : "standard",
      minimumFractionDigits: options.compact ? 0 : options.showMinorUnits === false ? 0 : Math.abs(majorAmount) < 1000 ? digits : 0,
      maximumFractionDigits: options.compact ? 1 : options.showMinorUnits === false ? 0 : Math.abs(majorAmount) < 1000 ? digits : 0,
    }).format(majorAmount);
  } catch {
    return `${money.currency} ${majorAmount.toFixed(digits)}`;
  }
}

export function formatMajorAmountForInput(money: Money | null | undefined): string {
  if (!money) return "";
  return String(convertMinorAmountToMajor(money));
}

export function readCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(defaultDisplayLocale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function addMoneyAmounts(first: Money, second: Money): Money {
  if (first.currency !== second.currency) throw new Error("Cannot add amounts in different currencies.");
  return { amountMinor: first.amountMinor + second.amountMinor, currency: first.currency };
}

export function createZeroMoney(currency: string): Money {
  return { amountMinor: 0, currency };
}
