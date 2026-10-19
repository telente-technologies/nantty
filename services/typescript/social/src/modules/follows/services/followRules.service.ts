import type { FollowState } from "../models/follow.model.js";

export type StoredFollowState = "requested" | "accepted" | "rejected";

export interface FollowDecisionInput {
  readonly followerIsBlockedByTarget: boolean;
  readonly followerHasBlockedTarget: boolean;
  readonly targetIsPrivate: boolean;
  readonly existing: StoredFollowState | undefined;
  readonly existingEndedAt?: Date | null;
  readonly now?: Date;
}

export const followRequestCooldownMs = 15 * 60 * 1000;

export type FollowDecision =
  | { readonly outcome: "refused" }
  | { readonly outcome: "coolingDown"; readonly retryAfterSeconds: number }
  | { readonly outcome: "unchanged"; readonly state: StoredFollowState }
  | { readonly outcome: "change"; readonly state: "requested" | "accepted" };

export function decideFollowOutcome(input: FollowDecisionInput): FollowDecision {
  if (input.followerHasBlockedTarget || input.followerIsBlockedByTarget) return { outcome: "refused" };
  if (input.existing === "accepted" || input.existing === "requested") return { outcome: "unchanged", state: input.existing };
  const remainingCooldownMs = remainingFollowRequestCooldownMs(input);
  if (input.targetIsPrivate && remainingCooldownMs > 0) return { outcome: "coolingDown", retryAfterSeconds: Math.ceil(remainingCooldownMs / 1000) };
  return { outcome: "change", state: input.targetIsPrivate ? "requested" : "accepted" };
}

function remainingFollowRequestCooldownMs(input: FollowDecisionInput): number {
  if (input.existing !== "rejected" || input.existingEndedAt === undefined || input.existingEndedAt === null || input.now === undefined) return 0;
  return Math.max(0, input.existingEndedAt.getTime() + followRequestCooldownMs - input.now.getTime());
}

export type FollowRequestResponse = "accept" | "reject";

export type FollowRequestResponseDecision = "apply" | "alreadyDone" | "conflict";

export function decideFollowRequestResponse(storedState: StoredFollowState, response: FollowRequestResponse): FollowRequestResponseDecision {
  if (storedState === "requested") return "apply";
  if ((storedState === "accepted" && response === "accept") || (storedState === "rejected" && response === "reject")) return "alreadyDone";
  return "conflict";
}

export function deriveViewerFollowState(viewerHasBlockedTarget: boolean, stored: StoredFollowState | undefined): FollowState {
  if (viewerHasBlockedTarget) return "blocked";
  return stored ?? "none";
}

export interface ProfileVisibilityInput {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly ownerIsPrivate: boolean;
  readonly viewerIsAcceptedFollower: boolean;
  readonly ownerHasBlockedViewer: boolean;
  readonly viewerHasBlockedOwner?: boolean;
}

export type ProfileVisibility = "visible" | "private" | "hidden";

export function decideProfileVisibility(input: ProfileVisibilityInput): ProfileVisibility {
  if (input.viewerId === input.ownerId) return "visible";
  if (input.ownerHasBlockedViewer || input.viewerHasBlockedOwner === true) return "hidden";
  if (!input.ownerIsPrivate) return "visible";
  return input.viewerIsAcceptedFollower ? "visible" : "private";
}
