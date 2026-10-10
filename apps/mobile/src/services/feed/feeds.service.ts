import type { SuggestedClip } from "@/types/commerce.type";
import type { Page, Post, Topic } from "@/types";

import { useAuthStore } from "@/store/auth.store";

import { api } from "../core/apiClient.service";

export const feedsService = {
  fetchForYouFeedPage: (topicId: string | null, cursor: string | null) =>
    api.get<Page<Post>>("/api/v1/feeds/for-you", { topicId: topicId ?? undefined, cursor: cursor ?? undefined }),
  fetchFollowingFeedPage: (cursor: string | null) => api.get<Page<Post>>("/api/v1/feeds/following", { cursor: cursor ?? undefined }),
  fetchSuggestedClips: () => api.getList<SuggestedClip>("/api/v1/feeds/suggested-clips"),
  fetchMyFollowedTopics: () => api.getList<Topic>(useAuthStore.getState().status === "signedIn" ? "/api/v1/users/me/topics" : "/api/v1/topics"),
};
