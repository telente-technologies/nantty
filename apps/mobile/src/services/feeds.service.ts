import type { SuggestedClip } from "@/types/commerce.type";
import type { Page, Post, Topic } from "@/types";

import { api } from "./apiClient.service";

export const feedsService = {
  fetchForYouFeedPage: (topicId: string | null, cursor: string | null) =>
    api.get<Page<Post>>("/api/v1/feeds/for-you", { topicId: topicId ?? undefined, cursor: cursor ?? undefined }),
  fetchFollowingFeedPage: (cursor: string | null) => api.get<Page<Post>>("/api/v1/feeds/following", { cursor: cursor ?? undefined }),
  fetchSuggestedClips: () => api.get<SuggestedClip[]>("/api/v1/feeds/suggested-clips"),
  fetchMyFollowedTopics: () => api.get<Topic[]>("/api/v1/users/me/topics"),
};
