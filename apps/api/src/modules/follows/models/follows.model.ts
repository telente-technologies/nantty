export type FollowTargetType = "user" | "store";

export interface FollowRecord {
  readonly followerId: string;
  readonly targetType: FollowTargetType;
  readonly targetId: string;
  readonly createdAt: Date;
}

export interface BlockRecord {
  readonly blockerId: string;
  readonly blockedId: string;
  readonly createdAt: Date;
}

export interface FollowStatus {
  readonly following: boolean;
  readonly followedBy: boolean;
  readonly blocked: boolean;
  readonly blockedBy: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
}
