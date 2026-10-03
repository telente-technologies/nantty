export interface DailyImpressions {
  readonly day: string;
  readonly impressions: number;
}

export function buildLastSevenDays(now: Date, counts: ReadonlyMap<string, number>): DailyImpressions[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() - (6 - index) * 86_400_000).toISOString().slice(0, 10);
    return { day, impressions: counts.get(day) ?? 0 };
  });
}
