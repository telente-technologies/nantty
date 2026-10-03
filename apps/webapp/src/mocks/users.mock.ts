import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";
import type { User } from "@/types";

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

const setFollowingAuthor = (userId: string, following: boolean) => {
  if (following) followedUserIds.add(userId);
  else followedUserIds.delete(userId);
  for (const [postId, post] of mockPostsState) {
    if (post.author.id === userId) mockPostsState.set(postId, { ...post, isFollowingAuthor: following });
  }
};

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
  createMockRoute("GET", "/api/v1/users/:userId/posts", ({ params }) => ({
    data: listPostsByAuthor(params.userId!).map(withCurrentProductPrices),
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/users/:userId/connections", ({ query }) => listConnections((query.get("tab") as ConnectionTab) ?? "followers")),
  createMockRoute("POST", "/api/v1/users/:userId/follow", ({ params }) => setFollowingAuthor(params.userId!, true)),
  createMockRoute("DELETE", "/api/v1/users/:userId/follow", ({ params }) => setFollowingAuthor(params.userId!, false)),
  createMockRoute("POST", "/api/v1/users/:userId/block", ({ params }) => {
    blockedUserIds.add(params.userId!);
    setFollowingAuthor(params.userId!, false);
  }),
  createMockRoute("DELETE", "/api/v1/users/:userId/block", ({ params }) => void blockedUserIds.delete(params.userId!)),
];
