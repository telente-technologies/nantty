import type { Money } from "@/types/api.type";

export const displayLocale = "en-NG";

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

export function convertMajorAmountToMinorUnits(majorAmount: number, currency: string): number {
  return Math.round(majorAmount * 10 ** readMinorUnitDigitsForCurrency(currency));
}

export function parseTypedMajorAmountToMoney(typedText: string, currency: string): Money | null {
  const cleaned = typedText.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{0,4})?$/.test(cleaned)) return null;
  return { amountMinor: convertMajorAmountToMinorUnits(Number(cleaned), currency), currency };
}

export function formatMoneyForDisplay(money: Money | null | undefined, options: { readonly compact?: boolean } = {}): string {
  if (!money) return "—";
  const majorAmount = convertMinorAmountToMajor(money);
  const digits = readMinorUnitDigitsForCurrency(money.currency);
  try {
    return new Intl.NumberFormat(displayLocale, {
      style: "currency",
      currency: money.currency,
      currencyDisplay: "narrowSymbol",
      notation: options.compact ? "compact" : "standard",
      minimumFractionDigits: options.compact ? 0 : digits,
      maximumFractionDigits: options.compact ? 1 : digits,
    }).format(majorAmount);
  } catch {
    return `${money.currency} ${majorAmount.toFixed(digits)}`;
  }
}

export function formatMajorAmountForInput(money: Money | null | undefined): string {
  return money ? String(convertMinorAmountToMajor(money)) : "";
}

export function formatWholeNumber(value: number, options: { readonly compact?: boolean } = {}): string {
  return new Intl.NumberFormat(displayLocale, { notation: options.compact ? "compact" : "standard", maximumFractionDigits: options.compact ? 1 : 0 }).format(value);
}

export function formatBasisPointsAsPercent(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString(displayLocale, { maximumFractionDigits: 2 })}%`;
}

export function formatDateTime(isoText: string | null | undefined): string {
  if (!isoText) return "—";
  return new Intl.DateTimeFormat(displayLocale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(isoText));
}

export function formatDateOnly(isoText: string | null | undefined): string {
  if (!isoText) return "—";
  return new Intl.DateTimeFormat(displayLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(isoText));
}

export function formatRelativeTimeFromNow(isoText: string | null | undefined, nowEpochMs: number = Date.now()): string {
  if (!isoText) return "—";
  const differenceInSeconds = Math.round((new Date(isoText).getTime() - nowEpochMs) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1]];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(differenceInSeconds) >= secondsInUnit || unit === "second") return formatter.format(Math.round(differenceInSeconds / secondsInUnit), unit);
  }
  return "—";
}

export function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function humanizeConstantName(constantName: string): string {
  const spaced = constantName.replace(/[_.-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
