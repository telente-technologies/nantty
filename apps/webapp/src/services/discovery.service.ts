import type { Clip, Page, Post, SuggestedLive, TrendingTopic, UserSummary } from "@/types";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const discoveryService = {
  fetchSuggestedAccounts: () => sendRequestToWebappServer<UserSummary[]>("/api/v1/users/suggested"),
  fetchTrendingTopics: () => sendRequestToWebappServer<TrendingTopic[]>("/api/v1/trending"),
  fetchClipsPage: (tab: "forYou" | "following", cursor: string | null) =>
    sendRequestToWebappServer<Page<Clip>>("/api/v1/clips", { query: { tab: tab === "following" ? "following" : undefined, cursor: cursor ?? undefined } }),
  fetchVideosPage: (cursor: string | null) => sendRequestToWebappServer<Page<Post>>("/api/v1/videos", { query: { cursor: cursor ?? undefined } }),
  fetchVideoById: (videoId: string) => sendRequestToWebappServer<Post>(`/api/v1/videos/${videoId}`),
  fetchSuggestedLives: () => sendListRequestToWebappServer<SuggestedLive>("/api/v1/lives/suggested"),
};
