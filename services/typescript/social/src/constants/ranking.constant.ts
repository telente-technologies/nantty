export const authorRankingTiers = ["none", "blue_essential", "blue_verified", "premium", "gold_business", "black_official"] as const;
export type AuthorRankingTier = (typeof authorRankingTiers)[number];
export const tierOrderFromLowest = ["blue_essential", "blue_verified", "premium", "gold_business", "black_official"] as const satisfies readonly AuthorRankingTier[];

export const hardMaximumTierBoost: Readonly<Record<AuthorRankingTier, number>> = {
  none: 1,
  blue_essential: 1.05,
  blue_verified: 1.08,
  premium: 1.1,
  gold_business: 1.12,
  black_official: 1.15,
};

export const defaultTierBoost: Readonly<Record<AuthorRankingTier, number>> = {
  none: 1,
  blue_essential: 1.02,
  blue_verified: 1.04,
  premium: 1.06,
  gold_business: 1.08,
  black_official: 1.1,
};

export const hardMaximumOfficialEditorialBoost = 1.15;
export const defaultOfficialEditorialBoost = 1.1;
export const hardMaximumCombinedBoost = 1.25;

export const feedRankTimeoutDefaultMilliseconds = 250;
export const rankingSettingsCacheMilliseconds = 60_000;
export const integrityCandidateLimit = 60;
export const integrityLikeSampleLimit = 6000;
export const integrityWindowHours = 48;
export const newAccountAgeDays = 7;
export const burstWindowMinutes = 10;
export const minimumEngagersForBurstCheck = 20;

export const trendCategories = ["for_you", "trending", "news", "sports", "entertainment", "music", "tech", "business", "fashion", "gaming", "comedy", "religion", "food", "politics", "lifestyle"] as const;
export type TrendCategoryTab = (typeof trendCategories)[number];
export type TrendCategory = Exclude<TrendCategoryTab, "for_you" | "trending"> | "other";
export const trendWindowHours = 24;
export const trendCandidatePostLimit = 1500;
export const trendMinimumDistinctAuthors = 3;
export const headlineCacheMilliseconds = 120_000;
