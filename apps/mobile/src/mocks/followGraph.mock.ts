import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry } from "@/types/account.type";
import type { FollowResult } from "@/types/socialGraph.type";

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

export const setFollowingAuthor = (userId: string, following: boolean) => {
  if (following) followedUserIds.add(userId);
  else followedUserIds.delete(userId);
  requestedUserIds.delete(userId);
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

export const followGraphMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/users/:userId/follow", ({ params }) => requestToFollowOrFollow(params.userId!)),
  createMockRoute("DELETE", "/api/v1/users/:userId/follow", ({ params }) => setFollowingAuthor(params.userId!, false)),
  createMockRoute("GET", "/api/v1/users/:userId/followers", ({ params, query }) => listConnectionsPage(params.userId!, followerUserIds, query)),
  createMockRoute("GET", "/api/v1/users/:userId/following", ({ params, query }) => listConnectionsPage(params.userId!, [...followedUserIds], query)),
  createMockRoute("GET", "/api/v1/users/me/follow-requests", () => ({ data: listIncomingFollowRequests(), nextCursor: null })),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/accept", ({ params }) => settleIncomingRequest(params.requestId!, true)),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/reject", ({ params }) => settleIncomingRequest(params.requestId!, false)),
];
