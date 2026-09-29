import { runNowOrQueueWhenOffline } from "@/store/offline.store";
import type { Post } from "@/types";

import { api } from "./apiClient.service";

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
  repostPost: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/repost`),
  recordPostShare: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/share`),
  followPostAuthor: async (userId: string) => {
    await runNowOrQueueWhenOffline({ kind: "followUser", payload: { userId } }, (idempotencyKey) =>
      api.post<void>(`/api/v1/users/${userId}/follow`, undefined, { idempotencyKey }),
    );
  },
};
