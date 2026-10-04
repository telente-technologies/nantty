import type { AuthorRankingTier } from "../constants/ranking.constant.js";

export interface RankingBoostPolicy {
  readonly version: number;
  readonly tierBoosts: Readonly<Record<AuthorRankingTier, number>>;
  readonly officialEditorialBoost: number;
}

export interface TrendRemoval {
  readonly kind: "hashtag" | "topic" | "headline";
  readonly key: string;
  readonly country: string;
  readonly reason: string;
}

export interface RankingSettings {
  readonly boostPolicy: RankingBoostPolicy;
  readonly trendRemovals: readonly TrendRemoval[];
}

export interface RankingSettingsSource {
  read(): Promise<RankingSettings>;
}
