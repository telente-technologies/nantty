import type { AuthorRankingTier } from "../constants/ranking.constant.js";
import type { EngagementIntegritySignals } from "../utils/engagementIntegrity.util.js";
import type { RankingBoostPolicy } from "./rankingSettings.interface.js";

export interface RankingCandidate {
  readonly postId: string;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly followedAuthor: boolean;
  readonly saveCount?: number;
  readonly hashtags?: readonly string[];
  readonly authorTier?: AuthorRankingTier;
  readonly authorIsOfficial?: boolean;
  readonly authorCountry?: string | null;
  readonly integrity?: EngagementIntegritySignals;
  readonly isPromoted?: boolean;
}

export type RankingExplanationCode = "following" | "trending_topic" | "similar_to_liked" | "popular_near_you" | "friends_engaged" | "fresh" | "popular" | "promoted" | "checkmark_boost" | "official_boost";

export interface RankingExplanation {
  readonly code: RankingExplanationCode;
  readonly label: string;
  readonly detail?: string | null;
}

export interface RankedCandidate extends RankingCandidate {
  readonly explanations?: readonly RankingExplanation[];
  readonly boostMultiplier?: number;
  readonly trustedEngagementShare?: number;
  readonly manipulated?: boolean;
}

export interface RankingContext {
  readonly viewerId: string | null;
  readonly personalized: boolean;
  readonly now: Date;
  readonly boostPolicy?: RankingBoostPolicy;
  readonly trendingHashtags?: readonly string[];
  readonly viewerCountry?: string | null;
}

export interface FeedRanker {
  rank(candidates: readonly RankingCandidate[], context: RankingContext): Promise<readonly RankedCandidate[]>;
}
