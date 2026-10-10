import { ApiError } from "@/errors/api.error";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";
import type { User } from "@/types";

import { getSignedInMockUser } from "./fixtures.mock";
import { getActiveActingProfileOfSignedInUser } from "./brands.mock";
import { SIGNED_IN_BUYER, mockOrderRecords } from "./orderFixtures.mock";
import { listPostsByAuthor, pinnedPostsFirst, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { withViewerSavedState } from "./savedEntries.mock";
import { setFollowingAuthor } from "./followGraph.mock";
import { blockedUserIds, canSignedInUserSeeProfileContent, followedUserIds, followerUserIds, followStateForUser, privateUserIds, relationshipDetailsFor } from "./socialGraph.mock";
import { findActiveLiveForHost } from "./activeLives.mock";
import { directoryStores, findDirectoryStoreById } from "./storeDirectory.mock";
import { mockBrandRecords } from "./brandDirectory.mock";
import { mockBusinessProfiles } from "./businessProfiles.mock";
import { SUSPENDED_USER_IDS, directoryUsers, directoryUsersExcludingAccounts, findDirectoryUserById, summariseUser } from "./userDirectory.mock";

const profileEditsByUserId = new Map<string, Partial<User>>();

export const applyProfileEditForSignedInUser = (patch: Partial<User>) => {
  const userId = getSignedInMockUser().id;
  profileEditsByUserId.set(userId, { ...profileEditsByUserId.get(userId), ...patch });
};

export const signedInProfile = (): User => {
  const base = getSignedInMockUser();
  const acting = getActiveActingProfileOfSignedInUser();
  // When the viewer switched to a business/brand/store profile, /users/me
  // presents that profile so the Me screen shows its posts, clips and shop.
  if (acting && acting.id !== base.id) {
    return { ...base, ...actingProfileAsUserFields(acting.id), ...profileEditsByUserId.get(acting.id) };
  }
  return { ...base, ...profileEditsByUserId.get(base.id), following: base.id === "u_me" ? followedUserIds.size + 403 : base.following };
};

/** Business/brand/store profiles present like normal profiles (posts, reposts, clips, shop) when viewed by others. */
export const findBusinessProfileUser = (profileId: string): User | null => {
  const fields = actingProfileAsUserFields(profileId);
  if (!fields) return null;
  const base = getSignedInMockUser();
  return { ...base, ...fields };
};

const actingProfileAsUserFields = (profileId: string): Partial<User> | null => {
  const store = directoryStores.find((candidate) => candidate.id === profileId);
  if (store) {
    return {
      id: store.id,
      name: store.name,
      username: store.handle,
      avatarUrl: null,
      bio: store.bio,
      verified: store.verified,
      followers: store.followers,
      following: 0,
      posts: listPostsByAuthor(store.id).length,
      joinedAt: store.joinedAt,
      isSeller: true,
      storeId: store.id,
    };
  }
  const brand = mockBrandRecords.find((candidate) => candidate.id === profileId);
  if (brand) {
    const base = getSignedInMockUser();
    return {
      id: brand.id,
      name: brand.name,
      username: brand.handle,
      avatarUrl: brand.logoUrl,
      bio: brand.description,
      verified: brand.verification !== null,
      verification: brand.verification,
      followers: brand.followers,
      following: 0,
      posts: listPostsByAuthor(brand.id).length,
      joinedAt: base.joinedAt,
      isSeller: brand.officialStoreId !== null,
      storeId: brand.officialStoreId,
    };
  }
  const business = mockBusinessProfiles.find((candidate) => candidate.id === profileId);
  if (business) {
    return {
      id: business.id,
      name: business.name,
      username: business.handle,
      avatarUrl: business.avatarUrl,
      bio: `${business.name} on Zudomart`,
      verified: false,
      followers: 0,
      following: 0,
      posts: listPostsByAuthor(business.id).length,
      joinedAt: new Date().toISOString(),
    };
  }
  return null;
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
    const businessProfile = findBusinessProfileUser(params.userId!);
    if (businessProfile) {
      return {
        ...businessProfile,
        live: findActiveLiveForHost(businessProfile.id),
        isPrivate: false,
        isFollowing: followedUserIds.has(businessProfile.id),
        followers: businessProfile.followers + (followedUserIds.has(businessProfile.id) ? 1 : 0),
      };
    }
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
    data: canSignedInUserSeeProfileContent(params.userId!) && !SUSPENDED_USER_IDS.has(params.userId!) ? listPostsByAuthor(params.userId!).sort(pinnedPostsFirst).map((post) => withViewerSavedState(withCurrentProductPrices(post))) : [],
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/users/:userId/connections", ({ query }) => listConnections((query.get("tab") as ConnectionTab) ?? "followers")),
  createMockRoute("POST", "/api/v1/users/:userId/block", ({ params }) => {
    blockedUserIds.add(params.userId!);
    setFollowingAuthor(params.userId!, false);
  }),
  createMockRoute("DELETE", "/api/v1/users/:userId/block", ({ params }) => void blockedUserIds.delete(params.userId!)),
];
