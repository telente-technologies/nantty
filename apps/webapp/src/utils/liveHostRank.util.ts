import type { LiveHostRanking } from "@/types";

export type LiveHostRankTier = "gold" | "silver" | "bronze" | "top10" | "top100" | "ranked";

const LIVE_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  justChatting: "Just chatting",
  gaming: "Gaming",
  music: "Music",
  irl: "IRL",
  education: "Learning",
  shopping: "Shopping",
};

const PERIOD_LABELS: Readonly<Record<LiveHostRanking["period"], string>> = { day: "today", week: "this week", month: "this month", all: "all time" };

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

export function describeHostRanking(ranking: LiveHostRanking) {
  const period = PERIOD_LABELS[ranking.period] ?? "this week";
  const categoryLabel = ranking.category ? LIVE_CATEGORY_LABELS[ranking.category] ?? null : null;
  const globalLine = `#${ranking.globalRank.toLocaleString("en-US")} globally ${period}`;
  const categoryLine = ranking.categoryRank && categoryLabel ? `#${ranking.categoryRank.toLocaleString("en-US")} in ${categoryLabel}` : null;
  return { globalLine, categoryLine, label: [globalLine, categoryLine].filter(Boolean).join(", ") };
}
