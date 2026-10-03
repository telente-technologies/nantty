import { formatDateTime } from "@/utils/formatting.util";

export function convertIsoToLocalDateTimeInputValue(isoText: string | null): string {
  if (!isoText) return "";
  const date = new Date(isoText);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function convertLocalDateTimeInputValueToIso(inputValue: string): string | null {
  if (!inputValue) return null;
  const date = new Date(inputValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function describeFeatureSchedule(startsAt: string, endsAt: string | null): string {
  return endsAt ? `${formatDateTime(startsAt)} to ${formatDateTime(endsAt)}` : `From ${formatDateTime(startsAt)}, no end`;
}
