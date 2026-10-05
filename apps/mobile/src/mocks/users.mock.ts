import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";
import type { User } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { SIGNED_IN_BUYER, mockOrderRecords } from "./orderFixtures.mock";
import { listPostsByAuthor, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { setFollowingAuthor } from "./followGraph.mock";
import { blockedUserIds, canSignedInUserSeeProfileContent, followedUserIds, followerUserIds, followStateForUser, privateUserIds, relationshipDetailsFor } from "./socialGraph.mock";
import { findActiveLiveForHost } from "./activeLives.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";
import { SUSPENDED_USER_IDS, directoryUsers, directoryUsersExcludingAccounts, findDirectoryUserById, summariseUser } from "./userDirectory.mock";

const profileEditsByUserId = new Map<string, Partial<User>>();

export const applyProfileEditForSignedInUser = (patch: Partial<User>) => {
  const userId = getSignedInMockUser().id;
  profileEditsByUserId.set(userId, { ...profileEditsByUserId.get(userId), ...patch });
};

export const signedInProfile = (): User => {
  const base = getSignedInMockUser();
  return { ...base, ...profileEditsByUserId.get(base.id), following: base.id === "u_me" ? followedUserIds.size + 403 : base.following };
};

const toConnectionEntry = (user: User): ConnectionEntry => ({ ...summariseUser(user), isFollowing: followedUserIds.has(user.id), ...relationshipDetailsFor(user.id) });

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

const previewUrlByMediaId = new Map<string, string>();

export const usersMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me", () => signedInProfile()),
  createMockRoute("POST", "/api/v1/users/me/media/upload-intents", ({ body }) => {
    const { purpose, previewUri } = body as { purpose: string; previewUri?: string };
    const mediaId = `media_${purpose}_${Date.now().toString(36)}`;
    previewUrlByMediaId.set(mediaId, previewUri ?? "");
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    return { mediaId, uploadUrl: `mock://upload/${mediaId}`, method: "PUT", headers: {}, publicUrl: previewUri ?? "", expiresAt, maximumSize: 5_242_880 };
  }),
  createMockRoute("PATCH", "/api/v1/users/me", ({ body }) => {
    const userId = getSignedInMockUser().id;
    const { avatarMediaId, bannerMediaId, ...rest } = body as Partial<User> & { avatarMediaId?: string | null; bannerMediaId?: string | null };
    const mediaEdits: { avatarUrl?: string | null; bannerUrl?: string | null } = {};
    if (avatarMediaId !== undefined) mediaEdits.avatarUrl = avatarMediaId ? previewUrlByMediaId.get(avatarMediaId) || null : null;
    if (bannerMediaId !== undefined) mediaEdits.bannerUrl = bannerMediaId ? previewUrlByMediaId.get(bannerMediaId) || null : null;
    profileEditsByUserId.set(userId, { ...profileEditsByUserId.get(userId), ...rest, ...mediaEdits });
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
    const isHiddenPrivateProfile = privateUserIds.has(user.id) && !followedUserIds.has(user.id);
    return {
      ...user,
      live: isHiddenPrivateProfile ? null : findActiveLiveForHost(user.id),
      isPrivate: privateUserIds.has(user.id),
      followState: followStateForUser(user.id),
      isFollowing: followedUserIds.has(user.id),
      followers: user.followers + (followedUserIds.has(user.id) ? 1 : 0),
    };
  }),
  createMockRoute("GET", "/api/v1/users/:userId/posts", ({ params }) => ({
    data: canSignedInUserSeeProfileContent(params.userId!) && !SUSPENDED_USER_IDS.has(params.userId!) ? listPostsByAuthor(params.userId!).map(withCurrentProductPrices) : [],
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/users/:userId/connections", ({ query }) => listConnections((query.get("tab") as ConnectionTab) ?? "followers")),
  createMockRoute("POST", "/api/v1/users/:userId/block", ({ params }) => {
    blockedUserIds.add(params.userId!);
    setFollowingAuthor(params.userId!, false);
  }),
  createMockRoute("DELETE", "/api/v1/users/:userId/block", ({ params }) => void blockedUserIds.delete(params.userId!)),
];
