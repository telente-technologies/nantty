import type { ID, Page } from "@/types";
import { THREAD_AD_SLOT_KIND, type ThreadAdDecision, type ThreadReply, type ThreadSort } from "@/types/postThread.type";

import { sendRequestToWebappServer } from "./clientApi.service";

const adSessionId = `ads_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const postThreadService = {
  fetchConversation: (postId: ID, sort: ThreadSort, cursor: string | null) =>
    sendRequestToWebappServer<Page<ThreadReply>>(`/api/v1/posts/${postId}/thread`, { query: { sort, cursor: cursor ?? undefined } }),
  fetchThreadReplies: (commentId: ID, cursor: string | null) =>
    sendRequestToWebappServer<Page<ThreadReply>>(`/api/v1/comments/${commentId}/thread`, { query: { cursor: cursor ?? undefined } }),
  decideThreadAd: (postId: ID, slotIndex: number, slotsSinceLastAd: number, neighbourContentIds: readonly ID[]) =>
    sendRequestToWebappServer<ThreadAdDecision>("/api/v1/ads/decide", {
      method: "POST",
      body: { slot: { kind: THREAD_AD_SLOT_KIND, contentId: postId, slotIndex, slotsSinceLastAd, neighbourContentIds: neighbourContentIds.slice(0, 10) }, sessionId: adSessionId },
    }),
  recordThreadAdEvent: (adId: ID, postId: ID, type: "impression" | "click") =>
    sendRequestToWebappServer<void>("/api/v1/ads/events", {
      method: "POST",
      body: { events: [{ campaignId: adId, placement: "feedCommentThread", type, itemId: postId, occurredAt: new Date().toISOString() }] },
    }),
};
