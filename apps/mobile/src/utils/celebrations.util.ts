import type { ActiveCelebration, CelebrationKind, CelebrationSurface, ViewerCelebrations } from "@/types/celebrations.type";

export function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th";
  return `${value}${suffix}`;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function birthdayMessage(name: string, age: number): { title: string; message: string } {
  const title = `Happy ${ordinal(age)} birthday, ${firstNameOf(name)}!`;
  return { title, message: `${title} Wishing you an amazing year ahead from all of us at Nantty.` };
}

export function anniversaryMessage(years: number): { title: string; message: string } {
  const title = `Happy ${ordinal(years)} Zudoversary!`;
  return { title, message: `${title} Thanks for being part of Nantty for ${years === 1 ? "1 year" : `${years} years`}.` };
}

export function celebrationSeenKey(accountId: string, kind: CelebrationKind, surface: CelebrationSurface, localDate: string): string {
  return `zm.celebration.${accountId}.${kind}.${surface}.${localDate}`;
}

export function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function statRows(stats: NonNullable<ViewerCelebrations["anniversary"]["stats"]>) {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: number | undefined) => {
    if (value !== undefined && value > 0) rows.push({ label, value: value.toLocaleString("en") });
  };
  add("Posts", stats.posts);
  add("Followers gained", stats.followers);
  add("Orders", stats.orders);
  add("Lives", stats.lives);
  return rows;
}

export function pickCelebration(celebrations: ViewerCelebrations, surface: CelebrationSurface, viewerName: string, extraStats?: ViewerCelebrations["anniversary"]["stats"]): ActiveCelebration | null {
  const { birthday, anniversary } = celebrations;
  if (birthday.today && birthday.age !== undefined && !birthday.shown[surface]) {
    return { kind: "birthday", ...birthdayMessage(viewerName, birthday.age), stats: [] };
  }
  if (anniversary.today && anniversary.years !== undefined && !anniversary.shown[surface]) {
    return { kind: "anniversary", ...anniversaryMessage(anniversary.years), stats: statRows({ ...extraStats, ...anniversary.stats }) };
  }
  return null;
}
