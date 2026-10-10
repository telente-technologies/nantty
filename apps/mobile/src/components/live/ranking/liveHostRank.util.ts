import type { LiveHostRanking } from "@/types";

export type LiveHostRankTier = "gold" | "silver" | "bronze" | "top10" | "top100" | "ranked";

export const LIVE_HOST_RANK_TIER_COLORS: Record<LiveHostRankTier, { ring: string; chip: string; chipInk: string }> = {
  gold: { ring: "#F5C518", chip: "#F5C518", chipInk: "#1A1400" },
  silver: { ring: "#C9D1DC", chip: "#C9D1DC", chipInk: "#14181F" },
  bronze: { ring: "#D9893D", chip: "#D9893D", chipInk: "#1F1206" },
  top10: { ring: "#8B5CF6", chip: "#8B5CF6", chipInk: "#FFFFFF" },
  top100: { ring: "#3B82F6", chip: "#3B82F6", chipInk: "#FFFFFF" },
  ranked: { ring: "rgba(255,255,255,0.7)", chip: "rgba(20,20,24,0.85)", chipInk: "#FFFFFF" },
};

export function isUsableHostRanking(ranking: LiveHostRanking | null | undefined): ranking is LiveHostRanking {
  return !!ranking && Number.isInteger(ranking.globalRank) && ranking.globalRank > 0;
}

export function tierForRank(rank: number): LiveHostRankTier {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  if (rank <= 10) return "top10";
  if (rank <= 100) return "top100";
  return "ranked";
}

export function formatRankChip(rank: number): string {
  return rank > 999 ? "#999+" : `#${rank}`;
}

const PERIOD_LABELS: Record<LiveHostRanking["period"], string> = { day: "today", week: "this week", month: "this month", all: "all time" };

export function describeHostRanking(ranking: LiveHostRanking, categoryLabel: string | null) {
  const period = PERIOD_LABELS[ranking.period] ?? "this week";
  const globalLine = `#${ranking.globalRank.toLocaleString("en-US")} globally ${period}`;
  const categoryLine = ranking.categoryRank && categoryLabel ? `#${ranking.categoryRank.toLocaleString("en-US")} in ${categoryLabel}` : null;
  return { globalLine, categoryLine, accessibilityLabel: [globalLine, categoryLine].filter(Boolean).join(", ") };
}
