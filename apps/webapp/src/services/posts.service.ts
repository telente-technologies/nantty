import type { CommentWithReplies, FollowState, Page, Post, PostAnalytics, PostNotificationLevel, ReplyPolicy, TaggedUser } from "@/types";
import type { ConnectionEntry, ConnectionTab, FollowRequest } from "@/types/account.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";
import type { LinkPreview } from "@/types/linkPreview.type";

export const postsService = {
  fetchPostById: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}`),
  fetchPostAnalytics: (postId: string) => sendRequestToWebappServer<PostAnalytics>(`/api/v1/posts/${postId}/analytics`),
  likePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "POST", idempotencyKey: createIdempotencyKey("like") }),
  unlikePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/like`, { method: "DELETE", idempotencyKey: createIdempotencyKey("unlike") }),
  deletePost: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}`, { method: "DELETE", idempotencyKey: createIdempotencyKey("delete") }),
  pinPost: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/pin`, { method: "PUT", idempotencyKey: createIdempotencyKey("pin") }),
  unpinPost: (postId: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/pin`, { method: "DELETE", idempotencyKey: createIdempotencyKey("unpin") }),
  refreshPostLinkPreview: (postId: string) => sendRequestToWebappServer<LinkPreview | null>(`/api/v1/posts/${postId}/link-preview`, { method: "POST" }),
  repostPost: (postId: string, text?: string) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/repost`, { method: "POST", body: text ? { text } : {}, idempotencyKey: createIdempotencyKey("repost") }),
  fetchCommentsPage: (postId: string, cursor: string | null | undefined) =>
    sendRequestToWebappServer<Page<CommentWithReplies>>(`/api/v1/posts/${postId}/comments`, { query: { cursor: cursor ?? undefined } }),
  fetchPostQuotes: (postId: string, cursor: string | null | undefined) => sendRequestToWebappServer<Page<Post>>(`/api/v1/posts/${postId}/quotes`, { query: { cursor: cursor ?? undefined } }),
  fetchPostTaggedUsers: (postId: string, cursor: string | null) =>
    sendRequestToWebappServer<Page<TaggedUser>>(`/api/v1/posts/${encodeURIComponent(postId)}/tagged-users`, { query: { cursor: cursor ?? undefined } }),
  updateReplySettings: (postId: string, replyPolicy: ReplyPolicy) => sendRequestToWebappServer<Post>(`/api/v1/posts/${postId}/reply-settings`, { method: "PATCH", body: { replyPolicy } }),
  mutePostNotifications: (postId: string) => sendRequestToWebappServer<{ readonly postId: string; readonly muted: boolean }>(`/api/v1/posts/${postId}/notifications-mute`, { method: "PUT", idempotencyKey: createIdempotencyKey("postmute") }),
  unmutePostNotifications: (postId: string) => sendRequestToWebappServer<{ readonly postId: string; readonly muted: boolean }>(`/api/v1/posts/${postId}/notifications-mute`, { method: "DELETE", idempotencyKey: createIdempotencyKey("postunmute") }),
  recordPostShare: (postId: string) => sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/share`, { method: "POST", body: {} }),
};

export const followsService = {
  followUser: (userId: string) => sendRequestToWebappServer<{ readonly state?: FollowState } | undefined>(`/api/v1/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/follow`, { method: "DELETE" }),
  blockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => sendRequestToWebappServer<void>(`/api/v1/users/${userId}/block`, { method: "DELETE" }),
  fetchPostNotifications: (userId: string) =>
    sendRequestToWebappServer<{ readonly level: PostNotificationLevel; readonly following: boolean }>(`/api/v1/users/${encodeURIComponent(userId)}/post-notifications`),
  setPostNotifications: (userId: string, level: PostNotificationLevel, idempotencyKey: string) =>
    sendRequestToWebappServer<{ readonly level: PostNotificationLevel; readonly following: boolean }>(`/api/v1/users/${encodeURIComponent(userId)}/post-notifications`, { method: "PUT", body: { level }, idempotencyKey }),
  listFollowersOfUser: (userId: string, query: string, cursor?: string) =>
    sendRequestToWebappServer<Page<ConnectionEntry>>(`/api/v1/users/${userId}/followers`, { query: { q: query || undefined, cursor } }),
  listFollowingOfUser: (userId: string, query: string, cursor?: string) =>
    sendRequestToWebappServer<Page<ConnectionEntry>>(`/api/v1/users/${userId}/following`, { query: { q: query || undefined, cursor } }),
  listConnectionsOfUser: (userId: string, tab: ConnectionTab) =>
    sendListRequestToWebappServer<ConnectionEntry>(`/api/v1/users/${userId}/connections`, { query: { tab } }),
  listMyBlockedUsers: () => sendListRequestToWebappServer<ConnectionEntry>("/api/v1/users/me/blocked"),
  listMyFollowRequests: (cursor?: string) => sendRequestToWebappServer<Page<FollowRequest>>("/api/v1/users/me/follow-requests", { query: { cursor } }),
  acceptFollowRequest: (requestId: string) => sendRequestToWebappServer<void>(`/api/v1/follow-requests/${requestId}/accept`, { method: "POST" }),
  rejectFollowRequest: (requestId: string) => sendRequestToWebappServer<void>(`/api/v1/follow-requests/${requestId}/reject`, { method: "POST" }),
};
