import type { Clip, Page, Post, Topic } from "@/types";
import type { SuggestedClip } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const feedsService = {
  fetchForYouFeedPage: (topicId: string | null, cursor: string | null) =>
    sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/for-you", { query: { topicId: topicId ?? undefined, cursor: cursor ?? undefined } }),
  fetchPopularFeedPage: (cursor: string | null) => sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/popular", { query: { cursor: cursor ?? undefined } }),
  fetchFollowingFeedPage: (cursor: string | null) =>
    sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/following", { query: { cursor: cursor ?? undefined } }),
  fetchSuggestedClips: () => sendRequestToWebappServer<SuggestedClip[]>("/api/v1/feeds/suggested-clips"),
  fetchSuggestedClipsPage: (cursor: string | null) => sendRequestToWebappServer<Page<Clip>>("/api/v1/clips", { query: { cursor: cursor ?? undefined } }),
  sendShowFewerClipsLikeThese: (clipIds: readonly string[]) =>
    Promise.allSettled(clipIds.map((postId) => sendRequestToWebappServer<void>("/api/v1/feeds/feedback", { method: "POST", body: { postId, kind: "less" } }))),
  fetchMyFollowedTopics: () => sendRequestToWebappServer<Topic[]>("/api/v1/users/me/topics"),
};
