import { defaultDisplayLocale } from "@/constants/locale.constant";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export type DateRangePreset = "today" | "yesterday" | "last_7_days" | "last_14_days" | "last_30_days" | "this_month" | "last_month" | "custom";

const millisecondsPerDay = 86_400_000;

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  return formatIsoDate(new Date(parseIsoDate(isoDate).getTime() + days * millisecondsPerDay));
}

export function countDaysInRangeInclusive(range: DateRange): number {
  return Math.round((parseIsoDate(range.to).getTime() - parseIsoDate(range.from).getTime()) / millisecondsPerDay) + 1;
}

export function listIsoDatesInRange(range: DateRange): string[] {
  const dates: string[] = [];
  for (let current = range.from; current <= range.to; current = addDaysToIsoDate(current, 1)) dates.push(current);
  return dates;
}

export function readTodayIsoDate(): string {
  return formatIsoDate(new Date());
}

export function buildDateRangeFromPreset(preset: Exclude<DateRangePreset, "custom">, today = readTodayIsoDate()): DateRange {
  const todayDate = parseIsoDate(today);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDaysToIsoDate(today, -1), to: addDaysToIsoDate(today, -1) };
    case "last_7_days":
      return { from: addDaysToIsoDate(today, -7), to: addDaysToIsoDate(today, -1) };
    case "last_14_days":
      return { from: addDaysToIsoDate(today, -14), to: addDaysToIsoDate(today, -1) };
    case "last_30_days":
      return { from: addDaysToIsoDate(today, -30), to: addDaysToIsoDate(today, -1) };
    case "this_month":
      return { from: formatIsoDate(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1))), to: today };
    case "last_month":
      return {
        from: formatIsoDate(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 1, 1))),
        to: formatIsoDate(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 0))),
      };
  }
}

export function buildPreviousPeriodForComparison(range: DateRange): DateRange {
  const length = countDaysInRangeInclusive(range);
  return { from: addDaysToIsoDate(range.from, -length), to: addDaysToIsoDate(range.from, -1) };
}

export const dateRangePresetLabels: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_14_days: "Last 14 days",
  last_30_days: "Last 30 days",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

export function formatShortDate(isoDateOrTimestamp: string): string {
  const date = isoDateOrTimestamp.length === 10 ? parseIsoDate(isoDateOrTimestamp) : new Date(isoDateOrTimestamp);
  return new Intl.DateTimeFormat(defaultDisplayLocale, { day: "numeric", month: "short", timeZone: isoDateOrTimestamp.length === 10 ? "UTC" : undefined }).format(date);
}

export function formatDateWithYear(isoDateOrTimestamp: string): string {
  const date = isoDateOrTimestamp.length === 10 ? parseIsoDate(isoDateOrTimestamp) : new Date(isoDateOrTimestamp);
  return new Intl.DateTimeFormat(defaultDisplayLocale, { day: "numeric", month: "short", year: "numeric", timeZone: isoDateOrTimestamp.length === 10 ? "UTC" : undefined }).format(date);
}

export function formatDateAndTime(timestamp: string): string {
  return new Intl.DateTimeFormat(defaultDisplayLocale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

export function formatDateRangeForDisplay(range: DateRange): string {
  return range.from === range.to ? formatDateWithYear(range.from) : `${formatShortDate(range.from)} – ${formatDateWithYear(range.to)}`;
}

export function formatRelativeTimeFromNow(timestamp: string): string {
  const secondsAgo = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(defaultDisplayLocale, { numeric: "auto" });
  if (Math.abs(secondsAgo) < 60) return "just now";
  if (Math.abs(secondsAgo) < 3600) return formatter.format(-Math.round(secondsAgo / 60), "minute");
  if (Math.abs(secondsAgo) < 86400) return formatter.format(-Math.round(secondsAgo / 3600), "hour");
  if (Math.abs(secondsAgo) < 86400 * 30) return formatter.format(-Math.round(secondsAgo / 86400), "day");
  return formatDateWithYear(timestamp);
}

export function isValidIsoDate(candidate: unknown): candidate is string {
  return typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(parseIsoDate(candidate).getTime());
}
