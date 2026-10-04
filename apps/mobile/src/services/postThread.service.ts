import type { ID, Page } from "@/types";
import { THREAD_AD_SLOT_KIND, type ThreadAdDecision, type ThreadReply, type ThreadSort } from "@/types/postThread.type";

import { api } from "./apiClient.service";

const adSessionId = `ads_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const postThreadService = {
  fetchConversation: (postId: ID, sort: ThreadSort, cursor?: string) =>
    api.get<Page<ThreadReply>>(`/api/v1/posts/${postId}/thread`, { sort, cursor }),
  fetchThreadReplies: (commentId: ID, cursor?: string) => api.get<Page<ThreadReply>>(`/api/v1/comments/${commentId}/thread`, { cursor }),
  decideThreadAd: (postId: ID, slotIndex: number, slotsSinceLastAd: number, neighbourContentIds: readonly ID[]) =>
    api.post<ThreadAdDecision>("/api/v1/ads/decide", {
      slot: { kind: THREAD_AD_SLOT_KIND, contentId: postId, slotIndex, slotsSinceLastAd, neighbourContentIds: neighbourContentIds.slice(0, 10) },
      sessionId: adSessionId,
    }),
};
