import type { Page } from "@/types";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";
import type { FollowRequest, FollowResult } from "@/types/socialGraph.type";

import { api } from "../core/apiClient.service";

export const followsService = {
  followUser: (userId: string) => api.post<FollowResult>(`/api/v1/users/${encodeURIComponent(userId)}/follow`),
  unfollowUser: (userId: string) => api.delete<void>(`/api/v1/users/${encodeURIComponent(userId)}/follow`),
  listConnectionsOfUser: (userId: string, tab: ConnectionTab) =>
    api.getList<ConnectionEntry>(`/api/v1/users/${encodeURIComponent(userId)}/connections`, { tab }),
  listFollowersOfUser: (userId: string, query: string, cursor?: string) =>
    api.get<Page<ConnectionEntry>>(`/api/v1/users/${encodeURIComponent(userId)}/followers`, { q: query, cursor }),
  listFollowingOfUser: (userId: string, query: string, cursor?: string) =>
    api.get<Page<ConnectionEntry>>(`/api/v1/users/${encodeURIComponent(userId)}/following`, { q: query, cursor }),
  listMyFollowRequests: (cursor?: string) => api.get<Page<FollowRequest>>("/api/v1/users/me/follow-requests", { cursor }),
  acceptFollowRequest: (requestId: string) => api.post<void>(`/api/v1/follow-requests/${encodeURIComponent(requestId)}/accept`),
  rejectFollowRequest: (requestId: string) => api.post<void>(`/api/v1/follow-requests/${encodeURIComponent(requestId)}/reject`),
  listMyBlockedUsers: () => api.getList<ConnectionEntry>("/api/v1/users/me/blocked"),
  blockUser: (userId: string) => api.post<void>(`/api/v1/users/${encodeURIComponent(userId)}/block`),
  unblockUser: (userId: string) => api.delete<void>(`/api/v1/users/${encodeURIComponent(userId)}/block`),
};
