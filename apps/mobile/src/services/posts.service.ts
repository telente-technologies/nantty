import type { Post } from "@/types";

import { api } from "./api-client.service";

export const postsService = {
  fetchPostById: (postId: string) => api.get<Post>(`/api/v1/posts/${postId}`),
  likePost: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/like`),
  unlikePost: (postId: string) => api.delete<void>(`/api/v1/posts/${postId}/like`),
  repostPost: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/repost`),
  recordPostShare: (postId: string) => api.post<void>(`/api/v1/posts/${postId}/share`),
  followPostAuthor: (userId: string) => api.post<void>(`/api/v1/users/${userId}/follow`),
};
