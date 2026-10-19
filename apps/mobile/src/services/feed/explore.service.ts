import type { Page } from "@/types";
import type { ExploreCategory, ExploreCategoryId, FollowSuggestion, HeadlinesPage, RankedPost, TrendsPage } from "@/types/explore.type";

import { api } from "../core/apiClient.service";

const categoryParam = (category: ExploreCategoryId) => (category === "for_you" || category === "trending" ? undefined : category);

export const exploreService = {
  listExploreCategories: () => api.get<{ data: ExploreCategory[] }>("/api/v1/explore/categories"),
  fetchTrends: (category: ExploreCategoryId, limit = 10) => api.get<TrendsPage>("/api/v1/explore/trends", { category: categoryParam(category), limit }),
  fetchHeadlines: (category: ExploreCategoryId) => api.get<HeadlinesPage>("/api/v1/explore/headlines", { category: categoryParam(category) }),
  fetchWhoToFollow: (limit = 3) => api.get<{ data: FollowSuggestion[] }>("/api/v1/explore/who-to-follow", { limit }),
  fetchPeopleYouMayKnow: (limit: number) => api.get<{ data: FollowSuggestion[] }>("/api/v1/explore/who-to-follow", { limit, includePrivate: "true" }),
  fetchPostsForYou: (category: ExploreCategoryId, cursor?: string | null) => api.get<Page<RankedPost>>("/api/v1/explore/posts-for-you", { category, cursor: cursor ?? undefined }),
};
