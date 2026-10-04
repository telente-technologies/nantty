import type { RankingTier, TrendRemovalReason } from "@/types/ranking.type";

export const rankingTierOrderFromLowest: readonly RankingTier[] = ["blue_essential", "blue_verified", "premium", "gold_business", "black_official"];

export const rankingTierLabels: Readonly<Record<RankingTier, string>> = {
  blue_essential: "Blue Essential",
  blue_verified: "Blue Verified",
  premium: "Premium",
  gold_business: "Gold Business",
  black_official: "Black / Official",
};

export const hardMaximumTierBoostBps: Readonly<Record<RankingTier, number>> = {
  blue_essential: 10_500,
  blue_verified: 10_800,
  premium: 11_000,
  gold_business: 11_200,
  black_official: 11_500,
};

export const hardMaximumOfficialEditorialBoostBps = 11_500;
export const hardMaximumCombinedBoostBps = 12_500;
export const neutralBoostBps = 10_000;

export const trendRemovalReasonLabels: Readonly<Record<TrendRemovalReason, string>> = {
  spam: "Spam",
  manipulation: "Manipulated engagement",
  hate: "Hate or harassment of a group",
  harassment: "Harassment of a person",
  misinformation: "Harmful misinformation",
  violence: "Violence or threats",
  sexual: "Sexual content",
  illegal: "Illegal activity",
  privacy: "Private information",
  other: "Other policy reason",
};
