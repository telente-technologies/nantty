import type { FollowState } from "@/types/socialGraph.type";

export type ProfileLock = "open" | "private" | "blocked";

export interface LockedProfileCopy {
  readonly title: string;
  readonly message: string;
}

export const lockedProfileCopyByLock: Readonly<Record<Exclude<ProfileLock, "open">, LockedProfileCopy>> = {
  private: { title: "This account is private", message: "Follow to see their photos and videos." },
  blocked: { title: "You blocked this account", message: "Unblock them to see their photos and videos." },
};

export const followButtonLabelForState = (state: FollowState | undefined) =>
  state === "accepted" ? "Following" : state === "requested" ? "Requested" : state === "blocked" ? "Unblock" : "Follow";

export const isFollowStateHighlighted = (state: FollowState | undefined) => state !== "accepted" && state !== "requested" && state !== "blocked";

export const resolveFollowStateOfUser = (user: { followState?: FollowState; isFollowing?: boolean }): FollowState =>
  user.followState ?? (user.isFollowing ? "accepted" : "none");

export const resolveProfileLock = (user: { isPrivate?: boolean; followState?: FollowState; isFollowing?: boolean }): ProfileLock => {
  const state = resolveFollowStateOfUser(user);
  if (state === "blocked") return "blocked";
  return user.isPrivate === true && state !== "accepted" ? "private" : "open";
};

export const isProfileContentHiddenFromViewer = (user: { isPrivate?: boolean; followState?: FollowState; isFollowing?: boolean }) => resolveProfileLock(user) !== "open";

export const followStatusPollIntervalMs = (state: FollowState | undefined): number | false => (state === "requested" ? 15_000 : false);
