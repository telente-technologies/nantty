import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";

import { api } from "./apiClient.service";

export const followsService = {
  followUser: (userId: string) => api.post<void>(`/api/v1/users/${encodeURIComponent(userId)}/follow`),
  unfollowUser: (userId: string) => api.delete<void>(`/api/v1/users/${encodeURIComponent(userId)}/follow`),
  listConnectionsOfUser: (userId: string, tab: ConnectionTab) =>
    api.get<ConnectionEntry[]>(`/api/v1/users/${encodeURIComponent(userId)}/connections`, { tab }),
  listMyBlockedUsers: () => api.get<ConnectionEntry[]>("/api/v1/users/me/blocked"),
  blockUser: (userId: string) => api.post<void>(`/api/v1/users/${encodeURIComponent(userId)}/block`),
  unblockUser: (userId: string) => api.delete<void>(`/api/v1/users/${encodeURIComponent(userId)}/block`),
};
