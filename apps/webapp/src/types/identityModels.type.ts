import type { ID, ISODate } from "./primitive.type";

export type VerificationColor = "blue" | "gold" | "black";
export type VerificationProfileType = "personal" | "business" | "government";
export type VerificationTier = "ESSENTIAL" | "VERIFIED" | "PREMIUM" | "PRO" | "OFFICIAL";
export type VerificationStatus = "none" | "pending" | "active" | "expired" | "revoked";

export interface Verification {
  readonly status: VerificationStatus;
  readonly type: VerificationProfileType;
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly badgeVisible: boolean;
}

export interface UserSummary {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator?: boolean;
  readonly verification?: Verification | null;
}

export type FollowState = "none" | "requested" | "accepted" | "rejected" | "blocked";
export type PostNotificationLevel = "off" | "posts" | "posts_and_lives";

export interface User extends UserSummary {
  readonly bio: string;
  readonly bannerUrl: string | null;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly phone?: string | null;
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly joinedAt: ISODate;
  readonly isFollowing?: boolean;
  readonly followState?: FollowState;
  readonly viewerPostNotifications?: PostNotificationLevel;
  readonly isSeller?: boolean;
  readonly profileKind?: "personal" | "store" | "business";
  readonly showsMart?: boolean;
  readonly isPremium?: boolean;
  readonly isPrivate?: boolean;
  readonly storeId?: ID | null;
  readonly birthdayToday?: boolean;
  readonly anniversaryToday?: boolean;
}
