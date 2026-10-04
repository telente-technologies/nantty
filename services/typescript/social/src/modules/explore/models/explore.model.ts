import type { AuthorRankingTier, TrendCategory } from "../../../constants/ranking.constant.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";

export interface TrendView {
  readonly hashtag: string;
  readonly label: string;
  readonly category: TrendCategory;
  readonly categoryLabel: string;
  readonly postCount: number;
  readonly authorCount: number;
  readonly rank: number;
  readonly scope: string;
  readonly context: string;
}

export interface TrendsPage {
  readonly scope: string;
  readonly category: TrendCategory | null;
  readonly items: readonly TrendView[];
  readonly source: "intelligence" | "deterministic";
  readonly generatedAt: string;
}

export interface HeadlineView {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: TrendCategory;
  readonly categoryLabel: string;
  readonly postIds: readonly string[];
  readonly postCount: number;
  readonly authorCount: number;
  readonly hashtags: readonly string[];
  readonly coverImageUrl: string | null;
  readonly sourceLabel: "Summarised from posts";
  readonly generatedBy: "extractive_v1" | "template_v1";
}

export interface HeadlinesPage {
  readonly scope: string;
  readonly items: readonly HeadlineView[];
  readonly generatedAt: string;
}

export interface FollowSuggestion {
  readonly user: UserSummary;
  readonly reason: { readonly code: "mutuals" | "interests" | "popular_in_region" | "popular"; readonly label: string };
  readonly isOfficial: boolean;
  readonly checkmarkTier: AuthorRankingTier;
}

export interface ExploreCategory {
  readonly id: string;
  readonly label: string;
}
