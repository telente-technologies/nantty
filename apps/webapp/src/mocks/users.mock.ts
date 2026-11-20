import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry, ConnectionTab, FollowRequest } from "@/types/account.type";
import type { Page, PostNotificationLevel, User } from "@/types";
import { sortPinnedPostsFirst } from "@/utils/profileContent.util";

import { pageOfMockClipsByAuthor } from "./clips.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { SIGNED_IN_BUYER, mockOrderRecords } from "./orderFixtures.mock";
import { listPostsByAuthor, mockPostsState, withCurrentProductPrices } from "./postCatalog.mock";
import { isMockEmailVerifiedForUser } from "./webActions.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds, followedUserIds, followerUserIds } from "./socialGraph.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";
import { directoryUsers, directoryUsersExcludingAccounts, findDirectoryUserById, summariseUser } from "./userDirectory.mock";

const profileEditsByUserId = new Map<string, Partial<User>>();

export const applyProfileEditForSignedInUser = (patch: Partial<User>) => {
  const userId = getSignedInMockUser().id;
  profileEditsByUserId.set(userId, { ...profileEditsByUserId.get(userId), ...patch });
};

export const signedInProfile = (): User => {
  const base = getSignedInMockUser();
  return { ...base, ...profileEditsByUserId.get(base.id), emailVerified: isMockEmailVerifiedForUser(base.id), following: base.id === "u_me" ? followedUserIds.size + 403 : base.following };
};

const toConnectionEntry = (user: User): ConnectionEntry => ({ ...summariseUser(user), isFollowing: followedUserIds.has(user.id) });

const storeOwnersIBoughtFrom = () =>
  [...new Set(mockOrderRecords.filter((record) => record.buyerUserId === SIGNED_IN_BUYER).map((record) => findDirectoryStoreById(record.storeId).ownerUserKey))];

function listConnections(tab: ConnectionTab): ConnectionEntry[] {
  const usersByIds = (ids: readonly string[]) => ids.map((id) => findDirectoryUserById(id)).filter((user): user is User => !!user);
  switch (tab) {
    case "followers":
      return usersByIds(followerUserIds).map(toConnectionEntry);
    case "following":
      return usersByIds([...followedUserIds]).map(toConnectionEntry);
    case "shopped":
      return usersByIds(storeOwnersIBoughtFrom()).map(toConnectionEntry);
    case "blocked":
      return usersByIds([...blockedUserIds]).map((user) => ({ ...toConnectionEntry(user), isFollowing: false }));
    default:
      return directoryUsersExcludingAccounts
        .filter((user) => !followedUserIds.has(user.id) && !blockedUserIds.has(user.id))
        .slice(0, 10)
        .map(toConnectionEntry);
  }
}

const postNotificationLevelByUserId = new Map<string, PostNotificationLevel>();
const postNotificationLevels: readonly PostNotificationLevel[] = ["off", "posts", "posts_and_lives"];

const postNotificationsOf = (userId: string) => {
  const following = followedUserIds.has(userId) && !blockedUserIds.has(userId);
  return { level: following ? (postNotificationLevelByUserId.get(userId) ?? "off") : "off", following };
};

const setPostNotificationsFor = (userId: string, body: unknown) => {
  const level = (body as { level?: unknown } | null)?.level;
  if (!postNotificationLevels.includes(level as PostNotificationLevel)) throw new ApiError(422, "Choose posts, posts_and_lives or off.", "VALIDATION_FAILED");
  if (userId === getSignedInMockUser().id) throw new ApiError(422, "You can't turn on post notifications for yourself.", "CANNOT_SUBSCRIBE_TO_SELF");
  if (blockedUserIds.has(userId)) throw new ApiError(403, "You can't get notifications from this account.", "POST_NOTIFICATIONS_NOT_ALLOWED");
  if (!followedUserIds.has(userId)) throw new ApiError(409, "Follow this account to get post notifications.", "NOT_FOLLOWING");
  postNotificationLevelByUserId.set(userId, level as PostNotificationLevel);
  return postNotificationsOf(userId);
};

const setFollowingAuthor = (userId: string, following: boolean) => {
  postNotificationLevelByUserId.delete(userId);
  if (following) followedUserIds.add(userId);
  else followedUserIds.delete(userId);
  for (const [postId, post] of mockPostsState) {
    if (post.author.id === userId) mockPostsState.set(postId, { ...post, isFollowingAuthor: following });
  }
};

const matchesConnectionQuery = (entry: ConnectionEntry, query: string | null): boolean => {
  const term = (query ?? "").trim().toLowerCase();
  if (!term) return true;
  return entry.name.toLowerCase().includes(term) || entry.username.toLowerCase().includes(term);
};

const pageOfConnections = (entries: ConnectionEntry[], query: string | null, cursor: string | null): Page<ConnectionEntry> => {
  const filtered = entries.filter((entry) => matchesConnectionQuery(entry, query));
  const start = Number(cursor ?? 0) || 0;
  const end = start + 20;
  return { data: filtered.slice(start, end), nextCursor: end < filtered.length ? String(end) : null };
};

const emptyFollowRequestsPage: Page<FollowRequest> = { data: [], nextCursor: null };

export const usersMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me", () => signedInProfile()),
  createMockRoute("PATCH", "/api/v1/users/me", ({ body }) => {
    const userId = getSignedInMockUser().id;
    profileEditsByUserId.set(userId, { ...profileEditsByUserId.get(userId), ...(body as Partial<User>) });
    return signedInProfile();
  }),
  createMockRoute("GET", "/api/v1/users/me/blocked", () => listConnections("blocked")),
  createMockRoute("GET", "/api/v1/users/by-username/:username", ({ params }) => {
    const handle = params.username!.toLowerCase();
    const signedIn = getSignedInMockUser();
    if (signedIn.username.toLowerCase() === handle) return { id: signedIn.id };
    const user = directoryUsers.find((candidate) => candidate.username.toLowerCase() === handle);
    if (!user) throw new ApiError(404, "This account doesn't exist");
    return { id: user.id };
  }),
  createMockRoute("GET", "/api/v1/users/:userId", ({ params }) => {
    if (params.userId === getSignedInMockUser().id || params.userId === "me") return signedInProfile();
    const user = findDirectoryUserById(params.userId!);
    if (!user) throw new ApiError(404, "This account doesn't exist");
    return { ...user, isFollowing: followedUserIds.has(user.id), followers: user.followers + (followedUserIds.has(user.id) ? 1 : 0) };
  }),
  createMockRoute("GET", "/api/v1/users/:userId/posts", ({ params, query }) => {
    if (query.get("kind") === "clip") return pageOfMockClipsByAuthor(params.userId!, query.get("cursor"));
    return {
      data: sortPinnedPostsFirst(listPostsByAuthor(params.userId!)).map(withCurrentProductPrices),
      nextCursor: null,
    };
  }),
  createMockRoute("GET", "/api/v1/users/:userId/connections", ({ query }) => listConnections((query.get("tab") as ConnectionTab) ?? "followers")),
  createMockRoute("GET", "/api/v1/users/:userId/followers", ({ query }) => pageOfConnections(listConnections("followers"), query.get("q"), query.get("cursor"))),
  createMockRoute("GET", "/api/v1/users/:userId/following", ({ query }) => pageOfConnections(listConnections("following"), query.get("q"), query.get("cursor"))),
  createMockRoute("GET", "/api/v1/users/me/follow-requests", () => emptyFollowRequestsPage),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/accept", () => undefined),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/reject", () => undefined),
  createMockRoute("GET", "/api/v1/users/:userId/follow-status", ({ params }) => {
    const userId = params.userId!;
    const user = findDirectoryUserById(userId);
    const following = followedUserIds.has(userId);
    return {
      state: blockedUserIds.has(userId) ? "blocked" : following ? "accepted" : "none", followedBy: followerUserIds.includes(userId),
      followersCount: (user?.followers ?? 0) + (following ? 1 : 0), followingCount: user?.following ?? 0, viewerPostNotifications: postNotificationsOf(userId).level,
    };
  }),
  createMockRoute("GET", "/api/v1/users/:userId/post-notifications", ({ params }) => postNotificationsOf(params.userId!)),
  createMockRoute("PUT", "/api/v1/users/:userId/post-notifications", ({ params, body }) => setPostNotificationsFor(params.userId!, body)),
  createMockRoute("POST", "/api/v1/users/:userId/follow", ({ params }) => {
    if (!followedUserIds.has(params.userId!)) setFollowingAuthor(params.userId!, true);
    return { state: "accepted" };
  }),
  createMockRoute("DELETE", "/api/v1/users/:userId/follow", ({ params }) => setFollowingAuthor(params.userId!, false)),
  createMockRoute("POST", "/api/v1/users/:userId/block", ({ params }) => {
    blockedUserIds.add(params.userId!);
    setFollowingAuthor(params.userId!, false);
  }),
  createMockRoute("DELETE", "/api/v1/users/:userId/block", ({ params }) => void blockedUserIds.delete(params.userId!)),
];
