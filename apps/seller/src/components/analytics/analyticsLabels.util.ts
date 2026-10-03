import type { AnalyticsSeriesBucket } from "@/types/analytics.type";

export const weekdayShortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatAnalyticsPeriodLabels(periodStart: string, bucket: AnalyticsSeriesBucket, locale: string): { label: string; shortLabel: string } {
  if (bucket === "hour") {
    const hourText = `${periodStart.slice(11, 13)}:00`;
    return { label: hourText, shortLabel: hourText };
  }
  const date = new Date(`${periodStart.slice(0, 10)}T12:00:00.000Z`);
  if (bucket === "month") {
    const monthText = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    return { label: monthText, shortLabel: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date) };
  }
  const dayText = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  if (bucket === "week") return { label: `Week of ${dayText}`, shortLabel: dayText };
  return { label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date), shortLabel: dayText };
}

export function formatHourSlotLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function countDaysInDateRange(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00.000Z`).getTime() - new Date(`${from}T12:00:00.000Z`).getTime()) / 86_400_000) + 1;
}
