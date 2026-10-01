import type { Page, Post, Topic } from "@/types";
import type { SuggestedClip } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const feedsService = {
  fetchForYouFeedPage: (topicId: string | null, cursor: string | null) =>
    sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/for-you", { query: { topicId: topicId ?? undefined, cursor: cursor ?? undefined } }),
  fetchFollowingFeedPage: (cursor: string | null) =>
    sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/following", { query: { cursor: cursor ?? undefined } }),
  fetchSuggestedClips: () => sendRequestToWebappServer<SuggestedClip[]>("/api/v1/feeds/suggested-clips"),
  fetchMyFollowedTopics: () => sendRequestToWebappServer<Topic[]>("/api/v1/users/me/topics"),
};
