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

export interface EngagementTotals {
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly shares: number;
  readonly saves: number;
}

export function summariseEngagement(totals: EngagementTotals, impressions: number): { readonly engagements: number; readonly engagementRate: number } {
  const engagements = totals.likes + totals.comments + totals.reposts + totals.shares + totals.saves;
  return { engagements, engagementRate: impressions <= 0 ? 0 : Math.round((engagements / impressions) * 10_000) / 10_000 };
}

export function buildAudienceSplit(followerViewers: number, totalViewers: number): { readonly label: string; readonly share: number }[] {
  if (totalViewers <= 0) return [];
  const followerShare = Math.round((followerViewers / totalViewers) * 1000) / 1000;
  return [{ label: "Followers", share: followerShare }, { label: "Non-followers", share: Math.round((1 - followerShare) * 1000) / 1000 }];
}
