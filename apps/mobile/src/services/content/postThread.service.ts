import { createSecureRandomHex } from "@/utils/secureRandomId.util";
import type { ID, Page } from "@/types";
import { THREAD_AD_SLOT_KIND, type CommentSectionFilter, type CommentThreadPage, type QuoteThreadItem, type ThreadAdDecision, type ThreadReply, type ThreadSort } from "@/types/postThread.type";

import { api } from "../core/apiClient.service";

const adSessionId = `ads_${Date.now().toString(36)}_${createSecureRandomHex(6)}`;

export const postThreadService = {
  fetchConversation: (postId: ID, sort: ThreadSort, cursor?: string, filter: CommentSectionFilter = "all") =>
    api.get<Page<ThreadReply | QuoteThreadItem>>(`/api/v1/posts/${postId}/thread`, { sort, cursor, ...(filter === "all" ? {} : { filter }) }),
  fetchThreadReplies: (commentId: ID, cursor?: string) => api.get<Page<ThreadReply>>(`/api/v1/comments/${commentId}/thread`, { cursor }),
  fetchCommentThread: (commentId: ID, cursor?: string) => api.get<CommentThreadPage>(`/api/v1/comments/${commentId}/thread`, { cursor }),
  decideThreadAd: (postId: ID, slotsSinceLastAd: number, neighbourContentIds: readonly ID[]) =>
    api.post<ThreadAdDecision>("/api/v1/ads/decide", {
      slot: { kind: THREAD_AD_SLOT_KIND, contentId: postId, slotsSinceLastAd, neighbourContentIds: neighbourContentIds.slice(0, 10) },
      sessionId: adSessionId,
    }),
};
