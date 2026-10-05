import type { CommentWithReplies, Page, Post, PostAnalytics, ReplyPolicy, TaggedUser } from "@/types";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";
import type { LinkPreview } from "@/types/linkPreview.type";

export const postsService = {
  fetchPostById: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}`),
  fetchPostAnalytics: (postId: string) => sendRequestToWebappServer<PostAnalytics>(`/api/v1/posts/${postId}/analytics`),
  likePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "POST", idempotencyKey: createIdempotencyKey("like") }),
  unlikePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "DELETE" }),
  refreshPostLinkPreview: (postId: string) => sendRequestToWebappServer<LinkPreview | null>(`/api/v1/posts/${postId}/link-preview`, { method: "POST" }),
  repostPost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/repost`, { method: "POST", body: {} }),
  fetchCommentsPage: (postId: string, cursor: string | null) =>
    sendRequestToWebappServer<Page<CommentWithReplies>>(`/api/v1/posts/${postId}/comments`, { query: { cursor: cursor ?? undefined } }),
  fetchPostQuotes: (postId: string, cursor: string | null) => sendRequestToWebappServer<Page<Post>>(`/api/v1/posts/${postId}/quotes`, { query: { cursor: cursor ?? undefined } }),
  fetchPostTaggedUsers: (postId: string, cursor: string | null) =>
    sendRequestToWebappServer<Page<TaggedUser>>(`/api/v1/posts/${encodeURIComponent(postId)}/tagged-users`, { query: { cursor: cursor ?? undefined } }),
  updateReplySettings: (postId: string, replyPolicy: ReplyPolicy) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/reply-settings`, { method: "PATCH", body: { replyPolicy } }),
  recordPostShare: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/share`, { method: "POST", body: {} }),
};

export const followsService = {
  followUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/follow`, { method: "DELETE" }),
  blockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "DELETE" }),
};
