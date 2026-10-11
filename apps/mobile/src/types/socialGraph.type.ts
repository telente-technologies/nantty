import type { ID, ISODate, UserSummary } from "./models.type";

export type FollowState = "none" | "requested" | "accepted" | "rejected" | "blocked";

export interface FollowResult {
  readonly state: FollowState;
}

export type PostNotificationLevel = "off" | "posts" | "posts_and_lives";

export interface PostNotificationSettings {
  readonly level: PostNotificationLevel;
  readonly following: boolean;
}

export interface FollowStatus {
  readonly state: FollowState;
  readonly followedBy: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
  readonly viewerPostNotifications: PostNotificationLevel;
}

export interface FollowRequest {
  readonly id: ID;
  readonly requester: UserSummary;
  readonly createdAt: ISODate;
}

export interface BusinessCategory {
  readonly id: ID;
  readonly parentId: ID | null;
  readonly kind: "business";
  readonly name: string;
  readonly slug: string;
  readonly active: boolean;
}

export interface BusinessCategorySelection {
  readonly categoryId: ID | null;
  readonly subcategoryId: ID | null;
  readonly customName: string | null;
}

export interface BusinessProfileInput {
  readonly displayName: string;
  readonly handle: string;
  readonly description: string;
  readonly categories: readonly BusinessCategorySelection[];
  readonly purpose?: "store" | "business";
}

export type LiveAdPlacement = "beforeJoin" | "naturalBreak" | "betweenSegments" | "overlay" | "end";

export interface LiveAdSettings {
  readonly allowAds: boolean;
  readonly placements: readonly LiveAdPlacement[];
  readonly maxInterruptions: number;
  readonly minIntervalMinutes: number;
  readonly showAdIndicator: boolean;
  readonly acceptedTermsVersion: string | null;
  readonly acceptedAt: ISODate | null;
}

export interface LiveMonetizationInput {
  readonly liveAdSettings: LiveAdSettings;
  readonly acceptedLiveAdTermsVersion: string | null;
  readonly sponsorshipLine: string | null;
}

export type LivePointsAction = "like" | "share" | "follow" | "watch";

export interface LivePointsAward {
  readonly awarded: number;
  readonly totalPoints: number;
  readonly likePointsThisMinute: number;
}

export interface LiveViewerPoints {
  readonly totalPoints: number;
  readonly likePointsThisMinute: number;
}
