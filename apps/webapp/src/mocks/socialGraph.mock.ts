import { findDirectoryUserById } from "./userDirectory.mock";

export const followedUserIds = new Set<string>(["u_1", "u_2", "u_3", "u_7", "u_9", "u_10", "u_12", "u_13", "u_15"]);

export const followerUserIds: readonly string[] = ["u_7", "u_8", "u_10", "u_11", "u_14", "u_17", "u_19", "u_20", "u_21", "u_23", "u_1", "u_13"];

export const blockedUserIds = new Set<string>(["u_22"]);

export const isFollowingUser = (userId: string) => followedUserIds.has(userId);

export const buildFriendsLikedFromFollowedUsers = (friendUserIds: readonly string[], totalCount: number) => ({
  count: totalCount,
  avatars: friendUserIds.map((userId) => findDirectoryUserById(userId)?.avatarUrl ?? null),
});
