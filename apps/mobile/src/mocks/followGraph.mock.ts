import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry } from "@/types/account.type";
import type { FollowResult, FollowStatus, PostNotificationLevel, PostNotificationSettings } from "@/types/socialGraph.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import {
  blockedUserIds,
  canSignedInUserSeeProfileContent,
  followedUserIds,
  followerUserIds,
  followStateForUser,
  incomingFollowRequestUserIds,
  listIncomingFollowRequests,
  privateUserIds,
  rejectedUserIds,
  relationshipDetailsFor,
  requestedUserIds,
} from "./socialGraph.mock";
import { findDirectoryUserById, summariseUser } from "./userDirectory.mock";

const PAGE_SIZE = 20;
const POST_NOTIFICATION_LEVELS: readonly PostNotificationLevel[] = ["off", "posts", "posts_and_lives"];
export const postNotificationLevels = new Map<string, PostNotificationLevel>();

export const setFollowingAuthor = (userId: string, following: boolean) => {
  if (following) followedUserIds.add(userId);
  else followedUserIds.delete(userId);
  requestedUserIds.delete(userId);
  if (!following) postNotificationLevels.delete(userId);
  for (const [postId, post] of mockPostsState) {
    if (post.author.id === userId) mockPostsState.set(postId, { ...post, isFollowingAuthor: following });
  }
};

const requestToFollowOrFollow = (userId: string): FollowResult => {
  if (blockedUserIds.has(userId)) throw new ApiError(403, "You can't follow this account");
  rejectedUserIds.delete(userId);
  if (privateUserIds.has(userId) && !followedUserIds.has(userId)) {
    requestedUserIds.add(userId);
    return { state: "requested" };
  }
  setFollowingAuthor(userId, true);
  return { state: "accepted" };
};

const toEntry = (userId: string): ConnectionEntry[] => {
  const user = findDirectoryUserById(userId);
  const followState = followStateForUser(userId);
  return user ? [{ ...summariseUser(user), isFollowing: followState === "accepted", followState, ...relationshipDetailsFor(userId) }] : [];
};

const listConnectionsPage = (ownerId: string, ids: readonly string[], query: URLSearchParams) => {
  const isOwner = ownerId === getSignedInMockUser().id || ownerId === "me";
  if (!isOwner && !canSignedInUserSeeProfileContent(ownerId)) throw new ApiError(403, "This account is private", "ACCOUNT_PRIVATE");
  const term = (query.get("q") ?? "").trim().toLowerCase();
  const offset = Number(query.get("cursor") ?? 0);
  const matches = ids.flatMap(toEntry).filter((entry) => !term || entry.name.toLowerCase().includes(term) || entry.username.toLowerCase().includes(term));
  const nextOffset = offset + PAGE_SIZE;
  return { data: matches.slice(offset, nextOffset), nextCursor: nextOffset < matches.length ? String(nextOffset) : null };
};

const resolveRequesterId = (requestId: string) => {
  const requesterId = requestId.replace(/^fr_/, "");
  if (!incomingFollowRequestUserIds.includes(requesterId)) throw new ApiError(404, "Request not found");
  return requesterId;
};

const settleIncomingRequest = (requestId: string, accept: boolean) => {
  const requesterId = resolveRequesterId(requestId);
  incomingFollowRequestUserIds.splice(incomingFollowRequestUserIds.indexOf(requesterId), 1);
  if (accept && !followerUserIds.includes(requesterId)) followerUserIds.unshift(requesterId);
};

const readPostNotifications = (userId: string): PostNotificationSettings => {
  const following = followStateForUser(userId) === "accepted";
  return { level: following ? (postNotificationLevels.get(userId) ?? "off") : "off", following };
};

const writePostNotifications = (userId: string, body: unknown): PostNotificationSettings => {
  const level = (body as { level?: unknown } | null)?.level;
  if (!POST_NOTIFICATION_LEVELS.includes(level as PostNotificationLevel)) throw new ApiError(400, "Choose off, posts or posts_and_lives.", "VALIDATION_FAILED");
  if (userId === getSignedInMockUser().id) throw new ApiError(422, "You can't turn on post notifications for yourself.", "CANNOT_SUBSCRIBE_TO_SELF");
  if (blockedUserIds.has(userId)) throw new ApiError(403, "You can't get notifications from this account.", "POST_NOTIFICATIONS_NOT_ALLOWED");
  if (followStateForUser(userId) !== "accepted") throw new ApiError(409, "Follow this account to get post notifications.", "NOT_FOLLOWING");
  postNotificationLevels.set(userId, level as PostNotificationLevel);
  return { level: level as PostNotificationLevel, following: true };
};

const readFollowStatus = (userId: string): FollowStatus => {
  const user = findDirectoryUserById(userId);
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  return {
    state: followStateForUser(userId), followedBy: followerUserIds.includes(userId),
    followersCount: user.followers, followingCount: user.following, viewerPostNotifications: readPostNotifications(userId).level,
  };
};

export const followGraphMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/:userId/follow-status", ({ params }) => readFollowStatus(params.userId!)),
  createMockRoute("GET", "/api/v1/users/:userId/post-notifications", ({ params }) => readPostNotifications(params.userId!)),
  createMockRoute("PUT", "/api/v1/users/:userId/post-notifications", ({ params, body }) => writePostNotifications(params.userId!, body)),
  createMockRoute("POST", "/api/v1/users/:userId/follow", ({ params }) => requestToFollowOrFollow(params.userId!)),
  createMockRoute("DELETE", "/api/v1/users/:userId/follow", ({ params }) => setFollowingAuthor(params.userId!, false)),
  createMockRoute("GET", "/api/v1/users/:userId/followers", ({ params, query }) => listConnectionsPage(params.userId!, followerUserIds, query)),
  createMockRoute("GET", "/api/v1/users/:userId/following", ({ params, query }) => listConnectionsPage(params.userId!, [...followedUserIds], query)),
  createMockRoute("GET", "/api/v1/users/me/follow-requests", () => ({ data: listIncomingFollowRequests(), nextCursor: null })),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/accept", ({ params }) => settleIncomingRequest(params.requestId!, true)),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/reject", ({ params }) => settleIncomingRequest(params.requestId!, false)),
];
