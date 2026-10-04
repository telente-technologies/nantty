import type { TrendCategory } from "../constants/ranking.constant.js";

export interface IntelligenceTrendItem {
  readonly itemId: string;
  readonly score: number;
  readonly distinctActors: number;
  readonly category: TrendCategory;
}

export interface HeadlineSourcePost {
  readonly postId: string;
  readonly authorId: string;
  readonly text: string;
  readonly hashtags: readonly string[];
  readonly createdAt: string;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly repostCount: number;
  readonly shareCount: number;
  readonly viewCount: number;
  readonly integrity?: unknown;
}

export interface IntelligenceHeadline {
  readonly storyKey: string;
  readonly title: string;
  readonly summary: string;
  readonly category: TrendCategory;
  readonly postIds: readonly string[];
  readonly postCount: number;
  readonly authorCount: number;
  readonly topHashtags: readonly string[];
  readonly generatedBy: "extractive_v1" | "template_v1";
}

export interface IntelligenceExploreClient {
  readTrendingHashtags(input: { readonly country: string | null; readonly category: TrendCategory | null; readonly limit: number; readonly excludedIds: readonly string[] }): Promise<readonly IntelligenceTrendItem[] | null>;
  buildHeadlines(input: { readonly country: string | null; readonly category: TrendCategory | null; readonly posts: readonly HeadlineSourcePost[]; readonly limit: number; readonly excludedStoryKeys: readonly string[] }): Promise<readonly IntelligenceHeadline[] | null>;
}
