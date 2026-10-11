import type { FollowState, PostNotificationLevel, User } from "@/types";

export interface FollowStatusWire {
  readonly state?: string;
  readonly followersCount?: number;
  readonly followingCount?: number;
  readonly viewerPostNotifications?: PostNotificationLevel;
}

const knownFollowStates: readonly FollowState[] = ["none", "requested", "accepted", "rejected", "blocked"];

export function mergeFollowStatusIntoProfile(user: User, status: FollowStatusWire | null): User {
  if (!status) return user;
  const followState = knownFollowStates.find((state) => state === status.state) ?? "none";
  return {
    ...user,
    isFollowing: followState === "accepted",
    followState,
    viewerPostNotifications: followState === "accepted" ? (status.viewerPostNotifications ?? "off") : "off",
    followers: typeof status.followersCount === "number" ? status.followersCount : user.followers,
    following: typeof status.followingCount === "number" ? status.followingCount : user.following,
  };
}
