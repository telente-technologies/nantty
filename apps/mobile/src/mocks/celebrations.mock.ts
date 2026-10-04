import type { CelebrationSettingsUpdate, ViewerCelebrations } from "@/types/celebrations.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const state = { timezone: "", birthdayBalloonsVisible: true, seen: new Set<string>() };

const localParts = (timezone: string, now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
};

const isLeap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const sameDay = (month: number, day: number, local: ReturnType<typeof localParts>) =>
  (month === local.month && day === local.day) || (month === 2 && day === 29 && !isLeap(local.year) && local.month === 2 && local.day === 28);

const buildCelebrations = (): ViewerCelebrations => {
  const local = localParts(state.timezone, new Date());
  const localDate = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  const joined = localParts(state.timezone, new Date(getSignedInMockUser().joinedAt));
  const years = local.year - joined.year;
  const anniversaryToday = years >= 1 && sameDay(joined.month, joined.day, local);
  const shown = (kind: string) => ({ app: state.seen.has(`${kind}.app.${localDate}`), profile: state.seen.has(`${kind}.profile.${localDate}`) });
  return {
    timezone: state.timezone || "UTC", timezoneConfigured: state.timezone !== "", localDate, birthdayBalloonsVisible: state.birthdayBalloonsVisible,
    birthday: { today: false, shown: shown("birthday") },
    anniversary: { today: anniversaryToday, ...(anniversaryToday ? { years } : {}), shown: shown("anniversary") },
  };
};

export const celebrationsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/celebrations", () => buildCelebrations()),
  createMockRoute("POST", "/api/v1/users/me/celebrations/seen", ({ body }) => {
    const { kind, surface } = body as { kind: string; surface: string };
    state.seen.add(`${kind}.${surface}.${buildCelebrations().localDate}`);
    return undefined;
  }),
  createMockRoute("PATCH", "/api/v1/users/me/celebrations/settings", ({ body }) => {
    const update = body as CelebrationSettingsUpdate;
    if (update.timezone !== undefined) state.timezone = update.timezone;
    if (update.birthdayBalloonsVisible !== undefined) state.birthdayBalloonsVisible = update.birthdayBalloonsVisible;
    return buildCelebrations();
  }),
];
