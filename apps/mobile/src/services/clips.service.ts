import type { Clip, ClipsFeedTab, Page } from "@/types";

import { api } from "./api-client.service";

export const clipsService = {
  fetchClipsFeed: (tab: ClipsFeedTab, cursor?: string) => api.get<Page<Clip>>("/api/v1/clips", { tab, cursor }),
  likeClip: (clipId: string) => api.post<void>(`/api/v1/posts/${clipId}/like`),
  unlikeClip: (clipId: string) => api.delete<void>(`/api/v1/posts/${clipId}/like`),
  recordClipShare: (clipId: string) => api.post<void>(`/api/v1/posts/${clipId}/share`),
  followClipAuthor: (userId: string) => api.post<void>(`/api/v1/users/${userId}/follow`),
};
