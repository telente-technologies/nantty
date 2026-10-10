import type { User } from "@/types";

export interface FollowStatusWire {
  readonly state?: string;
  readonly followersCount?: number;
  readonly followingCount?: number;
}

export function mergeFollowStatusIntoProfile(user: User, status: FollowStatusWire | null): User {
  if (!status) return user;
  return {
    ...user,
    isFollowing: status.state === "accepted",
    followers: typeof status.followersCount === "number" ? status.followersCount : user.followers,
    following: typeof status.followingCount === "number" ? status.followingCount : user.following,
  };
}
