import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";

export type FollowState = "none" | "requested" | "accepted" | "rejected" | "blocked";

export interface FollowResult {
  readonly state: FollowState;
}

export interface ConnectionEntry extends UserSummary {
  readonly isFollowing: boolean;
  readonly followState: FollowState;
  /** Whether this account has an accepted follow relationship to the viewer. */
  readonly followsYou: boolean;
  /** Number of accepted accounts both this account and the viewer follow. */
  readonly mutualConnections: number;
}

export interface FollowRequestView {
  readonly id: string;
  readonly requester: UserSummary;
  readonly createdAt: string;
}

export interface FollowStatusView {
  readonly state: FollowState;
  readonly followedBy: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
  readonly viewerPostNotifications: "off" | "posts" | "posts_and_lives";
}
