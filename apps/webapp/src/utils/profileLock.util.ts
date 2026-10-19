import type { FollowState } from "@/types";

export type ProfileLock = "open" | "private" | "blocked";

export interface LockedProfileCopy {
  readonly title: string;
  readonly message: string;
}

export const lockedProfileCopyByLock: Readonly<Record<Exclude<ProfileLock, "open">, LockedProfileCopy>> = {
  private: { title: "This account is private", message: "Follow to see their photos and videos." },
  blocked: { title: "You blocked this account", message: "Unblock them to see their photos and videos." },
};

export function resolveProfileLock(input: { readonly isSelf: boolean; readonly isPrivate?: boolean; readonly followState: FollowState }): ProfileLock {
  if (input.isSelf) return "open";
  if (input.followState === "blocked") return "blocked";
  return input.isPrivate === true && input.followState !== "accepted" ? "private" : "open";
}

export const followButtonLabelForState = (state: FollowState): string =>
  state === "accepted" ? "Following" : state === "requested" ? "Requested" : state === "blocked" ? "Unblock" : "Follow";

export const followStatusPollIntervalMs = (state: FollowState | undefined): number | false => (state === "requested" ? 15_000 : false);

export function followFailureMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null ? (error as { readonly code?: unknown }).code : undefined;
  return code === "FOLLOW_REQUEST_COOLDOWN" ? "You can ask to follow this account again in a little while." : "Couldn't update follow. Try again.";
}
