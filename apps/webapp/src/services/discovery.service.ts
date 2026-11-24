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
  fetchVideosPage: async (cursor: string | null): Promise<Page<Post>> => {
    const page = await sendRequestToWebappServer<Page<Post>>("/api/v1/feeds/popular", { query: { cursor: cursor ?? undefined } });
    return { ...page, data: page.data.filter((post) => post.media.some((item) => item.type === "video")) };
  },
  fetchVideoById: (videoId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${encodeURIComponent(videoId)}`),
  likeClip: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/like`, { method: "POST" }),
  unlikeClip: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/like`, { method: "DELETE" }),
  followClipAuthor: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${encodeURIComponent(userId)}/follow`, { method: "POST" }),
  recordClipShare: (clipId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${encodeURIComponent(clipId)}/share`, { method: "POST", body: {} }),
  recordAnalyticsEvents: (events: readonly { readonly domain: "commerce" | "creator" | "social" | "live" | "ads" | "developer"; readonly eventName: "content.viewed" | "content.engaged" | "profile.visited" | "product.viewed" | "cart.added" | "ad.viewed" | "ad.clicked"; readonly subjectId?: string; readonly storeId?: string; readonly eventKey?: string; readonly properties?: Readonly<Record<string, unknown>> }[]) =>
    sendRequestToWebappServer<{ accepted: number; ignored: number }>("/api/v1/analytics/events", { method: "POST", body: { events } }),
  fetchSuggestedLives: () => sendListRequestToWebappServer<SuggestedLive>("/api/v1/lives/suggested"),
};
