import type { Clip, ClipsFeedTab, Page } from "@/types";

import { api } from "./apiClient.service";
import { postsService } from "./posts.service";

export const clipsService = {
  fetchClipsFeed: (tab: ClipsFeedTab, cursor?: string) => api.get<Page<Clip>>("/api/v1/clips", { tab, cursor }),
  likeClip: (clipId: string) => postsService.likePost(clipId),
  unlikeClip: (clipId: string) => postsService.unlikePost(clipId),
  recordClipShare: (clipId: string) => api.post<void>(`/api/v1/posts/${clipId}/share`, {}),
  followClipAuthor: (userId: string) => postsService.followPostAuthor(userId),
};
