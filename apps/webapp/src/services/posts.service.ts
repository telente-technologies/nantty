import type { Post, PostAnalytics } from "@/types";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export const postsService = {
  fetchPostById: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}`),
  fetchPostAnalytics: (postId: string) => sendRequestToWebappServer<PostAnalytics>(`/api/v1/posts/${postId}/analytics`),
  likePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "POST", idempotencyKey: createIdempotencyKey("like") }),
  unlikePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "DELETE" }),
  repostPost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/repost`, { method: "POST" }),
  recordPostShare: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/share`, { method: "POST" }),
};

export const followsService = {
  followUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/follow`, { method: "DELETE" }),
  blockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "DELETE" }),
};
