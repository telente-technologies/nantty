import type { CommentWithReplies, Page, Post, PostAnalytics, ReplyPolicy, TaggedUser } from "@/types";
import type { ConnectionEntry, ConnectionTab, FollowRequest } from "@/types/account.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";
import type { LinkPreview } from "@/types/linkPreview.type";

export const postsService = {
  fetchPostById: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}`),
  fetchPostAnalytics: (postId: string) => sendRequestToWebappServer<PostAnalytics>(`/api/v1/posts/${postId}/analytics`),
  likePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "POST", idempotencyKey: createIdempotencyKey("like") }),
  unlikePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "DELETE" }),
  refreshPostLinkPreview: (postId: string) => sendRequestToWebappServer<LinkPreview | null>(`/api/v1/posts/${postId}/link-preview`, { method: "POST" }),
  repostPost: (postId: string, text?: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/repost`, { method: "POST", body: text ? { text } : {} }),
  fetchCommentsPage: (postId: string, cursor: string | null | undefined) =>
    sendRequestToWebappServer<Page<CommentWithReplies>>(`/api/v1/posts/${postId}/comments`, { query: { cursor: cursor ?? undefined } }),
  fetchPostQuotes: (postId: string, cursor: string | null | undefined) => sendRequestToWebappServer<Page<Post>>(`/api/v1/posts/${postId}/quotes`, { query: { cursor: cursor ?? undefined } }),
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
  listFollowersOfUser: (userId: string, query: string, cursor?: string) =>
    sendRequestToWebappServer<Page<ConnectionEntry>>(`/api/v1/users/${userId}/followers`, { query: { q: query || undefined, cursor } }),
  listFollowingOfUser: (userId: string, query: string, cursor?: string) =>
    sendRequestToWebappServer<Page<ConnectionEntry>>(`/api/v1/users/${userId}/following`, { query: { q: query || undefined, cursor } }),
  listConnectionsOfUser: (userId: string, tab: ConnectionTab) =>
    sendRequestToWebappServer<ConnectionEntry[]>(`/api/v1/users/${userId}/connections`, { query: { tab } }),
  listMyBlockedUsers: () => sendRequestToWebappServer<ConnectionEntry[]>("/api/v1/users/me/blocked"),
  listMyFollowRequests: (cursor?: string) => sendRequestToWebappServer<Page<FollowRequest>>("/api/v1/users/me/follow-requests", { query: { cursor } }),
  acceptFollowRequest: (requestId: string) => sendRequestToWebappServer<void>(`/api/v1/follow-requests/${requestId}/accept`, { method: "POST" }),
  rejectFollowRequest: (requestId: string) => sendRequestToWebappServer<void>(`/api/v1/follow-requests/${requestId}/reject`, { method: "POST" }),
};
