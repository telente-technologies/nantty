import type { LiveMonetizationInput } from "@/types/socialGraph.type";
import type { LiveCategory, LiveComment, LiveSessionDetails, Page, SuggestedLive, UserSummary } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

export interface LiveHostHeartbeat {
  readonly liveId: string;
  readonly status: "live" | "ended" | "upcoming";
  readonly leaseExpiresAt: string | null;
  readonly timeoutSeconds: number;
}

export const liveService = {
  fetchLiveSessionById: (liveId: string) => api.get<LiveSessionDetails>(`/api/v1/lives/${liveId}`),
  setCoinSupport: (liveId: string, enabled: boolean, idempotencyKey = generateIdempotencyKey()) =>
    api.patch<{ readonly liveId: string; readonly giftsEnabled: boolean }>(`/api/v1/lives/${liveId}/coin-support`, { enabled }, { idempotencyKey }),
  joinLiveSession: (liveId: string) => api.post<void>(`/api/v1/lives/${liveId}/join`),
  leaveLiveSession: (liveId: string) => api.post<void>(`/api/v1/lives/${liveId}/leave`),
  fetchLiveComments: (liveId: string, cursor?: string) => api.get<Page<LiveComment>>(`/api/v1/lives/${liveId}/comments`, { cursor }),
  sendCommentToLive: (liveId: string, text: string) => api.post<LiveComment>(`/api/v1/lives/${liveId}/comments`, { text }),
  sendReactionToLive: (liveId: string, emoji: string) => api.post<void>(`/api/v1/lives/${liveId}/reactions`, { emoji }),
  startLiveSessionWithTitle: (title: string, category: LiveCategory, monetization?: LiveMonetizationInput, storeId?: string | null) =>
    api.post<LiveSessionDetails>("/api/v1/lives", { title, category, ...monetization, ...(storeId ? { storeId } : {}) }),
  issueStreamKey: (liveId: string) => api.post<{ ingestUrl: string; streamKey: string }>(`/api/v1/lives/${liveId}/stream-key`),
  endLiveSession: (liveId: string) => api.post<void>(`/api/v1/lives/${liveId}/end`),
  sendHostHeartbeat: (liveId: string) => api.post<LiveHostHeartbeat>(`/api/v1/lives/${liveId}/heartbeat`),
  fetchSuggestedLives: () => api.getList<SuggestedLive>("/api/v1/lives/suggested"),
  fetchPeopleToShareLiveWith: async (query: string): Promise<UserSummary[]> => (query.trim() ? [...(await api.getList<UserSummary>("/api/v1/search/people", { q: query.trim() }))] : []),
  shareLiveWithPeople: (liveId: string, userIds: readonly string[]) => api.post<void>(`/api/v1/lives/${liveId}/share`, { userIds }),
  followLiveHost: (userId: string) => api.post<void>(`/api/v1/users/${userId}/follow`),
};
