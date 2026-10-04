import type { Post, UserSummary } from "./index";

export type ExploreCategoryId = "for_you" | "trending" | "news" | "sports" | "entertainment" | "music" | "tech" | "business" | "fashion" | "gaming" | "comedy" | "religion" | "food" | "politics" | "lifestyle";

export interface ExploreCategory {
  readonly id: ExploreCategoryId;
  readonly label: string;
}

export interface TrendItem {
  readonly hashtag: string;
  readonly label: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly postCount: number;
  readonly authorCount: number;
  readonly rank: number;
  readonly scope: string;
  readonly context: string;
}

export interface HeadlineItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly postIds: readonly string[];
  readonly postCount: number;
  readonly authorCount: number;
  readonly hashtags: readonly string[];
  readonly coverImageUrl: string | null;
  readonly sourceLabel: "Summarised from posts";
}

export interface FollowSuggestion {
  readonly user: UserSummary;
  readonly reason: { readonly code: string; readonly label: string };
  readonly isOfficial: boolean;
  readonly checkmarkTier: string;
}

export interface RankingExplanation {
  readonly code: string;
  readonly label: string;
  readonly detail?: string | null;
}

export type RankedPost = Post & { readonly ranking?: { readonly explanations: readonly RankingExplanation[]; readonly boostMultiplier: number } };
