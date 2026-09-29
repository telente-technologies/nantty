export function formatDateTimeForDisplay(isoDate: string | null | undefined, locale = "en-NG", timeZone = "Africa/Lagos"): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(isoDate));
}

export function formatDateForDisplay(isoDate: string | null | undefined, locale = "en-NG", timeZone = "Africa/Lagos"): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(isoDate));
}

export function formatTimeForDisplay(isoDate: string | null | undefined, locale = "en-NG", timeZone = "Africa/Lagos"): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(isoDate));
}

export function formatRelativeTimeFromNow(isoDate: string | null | undefined, locale = "en-NG"): string {
  if (!isoDate) return "—";
  const secondsDifference = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86_400], ["hour", 3_600], ["minute", 60]];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(secondsDifference) >= secondsInUnit) return relativeFormatter.format(Math.round(secondsDifference / secondsInUnit), unit);
  }
  return relativeFormatter.format(secondsDifference, "second");
}

export function formatIsoDateForDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDateRangeEndingToday(numberOfDays: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (numberOfDays - 1) * 86_400_000);
  return { from: formatIsoDateForDateInput(from), to: formatIsoDateForDateInput(to) };
}
