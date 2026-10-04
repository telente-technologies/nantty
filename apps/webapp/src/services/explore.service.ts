import type { Page } from "@/types";
import type { ExploreCategory, ExploreCategoryId, FollowSuggestion, HeadlineItem, RankedPost, TrendItem } from "@/types/explore.type";

import { sendRequestToWebappServer } from "./clientApi.service";

const categoryParam = (category: ExploreCategoryId) => (category === "for_you" || category === "trending" ? undefined : category);

export const exploreService = {
  listExploreCategories: () => sendRequestToWebappServer<{ data: ExploreCategory[] }>("/api/v1/explore/categories"),
  fetchTrends: (category: ExploreCategoryId) => sendRequestToWebappServer<{ scope: string; items: TrendItem[] }>("/api/v1/explore/trends", { query: { category: categoryParam(category), limit: 10 } }),
  fetchHeadlines: (category: ExploreCategoryId) => sendRequestToWebappServer<{ scope: string; items: HeadlineItem[] }>("/api/v1/explore/headlines", { query: { category: categoryParam(category) } }),
  fetchWhoToFollow: () => sendRequestToWebappServer<{ data: FollowSuggestion[] }>("/api/v1/explore/who-to-follow", { query: { limit: 3 } }),
  fetchPostsForYou: (category: ExploreCategoryId, cursor: string | null) => sendRequestToWebappServer<Page<RankedPost>>("/api/v1/explore/posts-for-you", { query: { category, cursor: cursor ?? undefined } }),
};
