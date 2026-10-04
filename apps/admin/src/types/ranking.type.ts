export type RankingTier = "blue_essential" | "blue_verified" | "premium" | "gold_business" | "black_official";

export interface FeedRankingPolicy {
  readonly tierBoostBps: Readonly<Record<RankingTier, number>>;
  readonly officialEditorialBoostBps: number;
}

export type TrendRemovalKind = "hashtag" | "topic" | "headline";
export type TrendRemovalReason = "spam" | "manipulation" | "hate" | "harassment" | "misinformation" | "violence" | "sexual" | "illegal" | "privacy" | "other";

export interface TrendRemoval {
  readonly kind: TrendRemovalKind;
  readonly key: string;
  readonly country: string;
  readonly reason: TrendRemovalReason;
  readonly note: string;
  readonly removedAt: string;
}

export interface TrendingModerationSetting {
  readonly key: "trending.moderation";
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly value: { readonly removals: readonly TrendRemoval[] };
}
