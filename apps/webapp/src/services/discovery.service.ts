import type { Clip, Page, Post, SuggestedLive, TrendingTopic, UserSummary } from "@/types";
import type { FollowSuggestion, TrendItem } from "@/types/explore.type";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const discoveryService = {
  fetchSuggestedAccounts: async (): Promise<UserSummary[]> =>
    (await sendListRequestToWebappServer<FollowSuggestion>("/api/v1/explore/who-to-follow", { query: { limit: 4 } })).map((suggestion) => suggestion.user),
  fetchFollowSuggestions: (limit: number) => sendListRequestToWebappServer<FollowSuggestion>("/api/v1/explore/who-to-follow", { query: { limit } }),
  fetchPeopleYouMayKnow: (limit: number) => sendListRequestToWebappServer<FollowSuggestion>("/api/v1/explore/who-to-follow", { query: { limit, includePrivate: "true" } }),
  fetchTrendingTopics: async (): Promise<TrendingTopic[]> =>
    (await sendRequestToWebappServer<{ items: readonly TrendItem[] }>("/api/v1/explore/trends", { query: { limit: 5 } })).items.map((trend) => ({ tag: trend.label, postCount: trend.postCount, category: trend.categoryLabel })),
  fetchClipsPage: (tab: "forYou" | "following", cursor: string | null) =>
    sendRequestToWebappServer<Page<Clip>>("/api/v1/clips", { query: { tab: tab === "following" ? "following" : undefined, cursor: cursor ?? undefined } }),
  fetchVideosPage: (cursor: string | null) => sendRequestToWebappServer<Page<Post>>("/api/v1/videos", { query: { cursor: cursor ?? undefined } }),
  fetchVideoById: (videoId: string) => sendRequestToWebappServer<Post>(`/api/v1/videos/${videoId}`),
  likeClip: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/like`, { method: "POST" }),
  unlikeClip: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/like`, { method: "DELETE" }),
  followClipAuthor: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${encodeURIComponent(userId)}/follow`, { method: "POST" }),
  recordClipShare: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/share`, { method: "POST", body: {} }),
  fetchSuggestedLives: () => sendListRequestToWebappServer<SuggestedLive>("/api/v1/lives/suggested"),
};
