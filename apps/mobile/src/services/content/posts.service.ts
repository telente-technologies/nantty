import { runNowOrQueueWhenOffline } from "@/store/offline.store";
import type { Page, Post, PostAnalytics, ReplyPolicy, SensitiveLabel, TaggedUser } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";
import type { LinkPreview } from "@/types";

export const postsService = {
  fetchPostById: (postId: string) => api.get<Post>(`/api/v1/posts/${postId}`),
  likePost: async (postId: string) => {
    await runNowOrQueueWhenOffline({ kind: "likePost", payload: { postId } }, (idempotencyKey) =>
      api.post<void>(`/api/v1/posts/${postId}/like`, undefined, { idempotencyKey }),
    );
  },
  unlikePost: async (postId: string) => {
    await runNowOrQueueWhenOffline({ kind: "unlikePost", payload: { postId } }, (idempotencyKey) =>
      api.delete<void>(`/api/v1/posts/${postId}/like`, { idempotencyKey }),
    );
  },
  repostPost: (postId: string, text?: string) => api.post<Post>(`/api/v1/posts/${postId}/repost`, text ? { text } : {}, { idempotencyKey: generateIdempotencyKey() }),
  fetchPostQuotes: (postId: string, cursor?: string) => api.get<Page<Post>>(`/api/v1/posts/${postId}/quotes`, { cursor }),
  fetchPostTaggedUsers: (postId: string, cursor?: string) => api.get<Page<TaggedUser>>(`/api/v1/posts/${encodeURIComponent(postId)}/tagged-users`, { cursor }),
  updateReplySettings: (postId: string, replyPolicy: ReplyPolicy) => api.patch<Post>(`/api/v1/posts/${postId}/reply-settings`, { replyPolicy }),
  updatePostSensitivity: (postId: string, sensitiveLabels: readonly SensitiveLabel[]) => api.patch<Post>(`/api/v1/posts/${postId}/sensitivity`, { sensitiveLabels }),
  fetchPostAnalytics: (postId: string) => api.get<PostAnalytics>(`/api/v1/posts/${postId}/analytics`),
  recordPostShare: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/share`, {}),
  mutePostNotifications: (postId: string) => api.put<{ readonly postId: string; readonly muted: boolean }>(`/api/v1/posts/${postId}/notifications-mute`, undefined, { idempotencyKey: generateIdempotencyKey() }),
  unmutePostNotifications: (postId: string) => api.delete<{ readonly postId: string; readonly muted: boolean }>(`/api/v1/posts/${postId}/notifications-mute`, { idempotencyKey: generateIdempotencyKey() }),
  deletePost: (postId: string) => api.delete<void>(`/api/v1/posts/${postId}`, { idempotencyKey: generateIdempotencyKey() }),
  pinPost: (postId: string) => api.put<Post>(`/api/v1/posts/${postId}/pin`),
  unpinPost: (postId: string) => api.delete<Post>(`/api/v1/posts/${postId}/pin`),
  refreshPostLinkPreview: (postId: string) => api.post<LinkPreview | null>(`/api/v1/posts/${postId}/link-preview`),
  followPostAuthor: async (userId: string) => {
    await runNowOrQueueWhenOffline({ kind: "followUser", payload: { userId } }, (idempotencyKey) =>
      api.post<void>(`/api/v1/users/${userId}/follow`, undefined, { idempotencyKey }),
    );
  },
};
