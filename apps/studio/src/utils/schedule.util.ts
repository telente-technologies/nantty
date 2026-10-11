import type { ISODate } from "@/types";

export const MINIMUM_LEAD_MINUTES = 5;
export const MAXIMUM_SCHEDULE_DAYS = 90;

const pad = (value: number) => String(value).padStart(2, "0");

export function formatScheduleTime(date: ISODate, locale = "en-GB"): string {
  return new Date(date).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateScheduleTime(value: string, now = Date.now()): { readonly date: Date | null; readonly error: string | null } {
  const date = parseLocalInputValue(value);
  if (!date) return { date: null, error: "Pick a date and time." };
  if (date.getTime() < now + MINIMUM_LEAD_MINUTES * 60_000) return { date: null, error: `Pick a time at least ${MINIMUM_LEAD_MINUTES} minutes from now.` };
  if (date.getTime() > now + MAXIMUM_SCHEDULE_DAYS * 86_400_000) return { date: null, error: `You can schedule up to ${MAXIMUM_SCHEDULE_DAYS} days ahead.` };
  return { date, error: null };
}

export function describeTimeUntil(date: ISODate, now = Date.now()): string {
  const minutes = Math.round((new Date(date).getTime() - now) / 60_000);
  if (minutes <= 0) return "Due now";
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `In ${hours} h`;
  return `In ${Math.round(hours / 24)} days`;
}
