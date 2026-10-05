import type { FollowRequest, FollowState } from "@/types/socialGraph.type";

import { findDirectoryUserById } from "./userDirectory.mock";

export const followedUserIds = new Set<string>(["u_1", "u_2", "u_3", "u_7", "u_9", "u_10", "u_12", "u_13", "u_15"]);

export const followerUserIds: string[] = ["u_7", "u_8", "u_10", "u_11", "u_14", "u_17", "u_19", "u_20", "u_21", "u_23", "u_1", "u_13"];

export const blockedUserIds = new Set<string>(["u_22"]);

export const privateUserIds = new Set<string>(["u_4", "u_5", "u_9"]);

export const requestedUserIds = new Set<string>();

export const rejectedUserIds = new Set<string>();

export const incomingFollowRequestUserIds: string[] = ["u_16", "u_18", "u_24"];

export const followStateForUser = (userId: string): FollowState =>
  blockedUserIds.has(userId) ? "blocked" : followedUserIds.has(userId) ? "accepted" : requestedUserIds.has(userId) ? "requested" : rejectedUserIds.has(userId) ? "rejected" : "none";

export const canSignedInUserSeeProfileContent = (userId: string) => !privateUserIds.has(userId) || followStateForUser(userId) === "accepted";

export const isAuthorContentVisibleToSignedInViewer = (authorId: string) =>
  authorId === "u_me" || authorId === "u_buyer" ? true : canSignedInUserSeeProfileContent(authorId);

export const listIncomingFollowRequests = (): FollowRequest[] =>
  incomingFollowRequestUserIds.flatMap((userId) => {
    const user = findDirectoryUserById(userId);
    return user ? [{ id: `fr_${userId}`, requester: { id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl, verified: user.verified, verification: user.verification }, createdAt: new Date(Date.now() - 3_600_000).toISOString() }] : [];
  });

export const isFollowingUser = (userId: string) => followedUserIds.has(userId);

export const buildFriendsLikedFromFollowedUsers = (friendUserIds: readonly string[], totalCount: number) => ({
  count: totalCount,
  avatars: friendUserIds.map((userId) => findDirectoryUserById(userId)?.avatarUrl ?? null),
});

export const mutualConnectionsWith = (userId: string) => {
  let hash = 0;
  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return followerUserIds.includes(userId) && followedUserIds.has(userId) ? 6 + (hash % 20) : hash % 12;
};

export const relationshipDetailsFor = (userId: string) => ({ followsYou: followerUserIds.includes(userId), mutualConnections: mutualConnectionsWith(userId) });
