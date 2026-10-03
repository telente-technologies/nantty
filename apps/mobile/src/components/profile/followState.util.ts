import type { FollowState } from "@/types/socialGraph.type";

export const followButtonLabelForState = (state: FollowState | undefined) =>
  state === "accepted" ? "Following" : state === "requested" ? "Requested" : "Follow";

export const isFollowStateHighlighted = (state: FollowState | undefined) => state !== "accepted" && state !== "requested";

export const resolveFollowStateOfUser = (user: { followState?: FollowState; isFollowing?: boolean }): FollowState =>
  user.followState ?? (user.isFollowing ? "accepted" : "none");

export const isProfileContentHiddenFromViewer = (user: { isPrivate?: boolean; followState?: FollowState; isFollowing?: boolean }) =>
  user.isPrivate === true && resolveFollowStateOfUser(user) !== "accepted";
