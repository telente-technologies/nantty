import type { QueryClient } from "@tanstack/react-query";

import type { FollowState, PostNotificationLevel } from "@/types";

import { setFollowingAuthorEverywhere, updateMatchingRecordsInEveryQuery } from "./postEngagementCache.util";

export type FollowToggleAction = "follow" | "unfollow" | "cancelRequest";

export interface FollowConfirmationCopy {
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

export const isActiveFollowState = (state: FollowState) => state === "accepted" || state === "requested";

export function followToggleActionFor(state: FollowState): FollowToggleAction {
  if (state === "accepted") return "unfollow";
  if (state === "requested") return "cancelRequest";
  return "follow";
}

export function followConfirmationCopy(action: FollowToggleAction, handle: string): FollowConfirmationCopy | null {
  if (action === "unfollow") return { title: `Unfollow @${handle}?`, description: "Their posts will no longer show up in your Following feed.", confirmLabel: "Unfollow", cancelLabel: "Cancel" };
  if (action === "cancelRequest") return { title: "Cancel follow request?", description: `@${handle} won't see your request anymore.`, confirmLabel: "Cancel request", cancelLabel: "Keep request" };
  return null;
}

export interface FollowToggleDeps {
  readonly confirm: (copy: FollowConfirmationCopy) => Promise<boolean>;
  readonly follow: () => Promise<{ readonly state?: FollowState } | undefined | void>;
  readonly unfollow: () => Promise<unknown>;
  readonly apply: (state: FollowState) => void;
  readonly onFailed: (error: unknown) => void;
}

export interface FollowToggleRunner {
  readonly run: (current: FollowState, handle: string) => Promise<FollowState>;
  readonly isBusy: () => boolean;
}

export function createFollowToggleRunner(deps: FollowToggleDeps): FollowToggleRunner {
  let busy = false;
  return {
    isBusy: () => busy,
    run: async (current, handle) => {
      if (busy) return current;
      busy = true;
      try {
        const action = followToggleActionFor(current);
        const copy = followConfirmationCopy(action, handle);
        if (copy !== null && !(await deps.confirm(copy))) return current;
        const optimistic: FollowState = action === "follow" ? "accepted" : "none";
        deps.apply(optimistic);
        try {
          if (action === "follow") {
            const result = await deps.follow();
            const settled: FollowState = result && result.state === "requested" ? "requested" : "accepted";
            if (settled !== optimistic) deps.apply(settled);
            return settled;
          }
          await deps.unfollow();
          return optimistic;
        } catch (error) {
          deps.apply(current);
          deps.onFailed(error);
          return current;
        }
      } finally {
        busy = false;
      }
    },
  };
}

export function setFollowStateEverywhere(queryClient: QueryClient, userId: string, state: FollowState) {
  const isFollowing = state === "accepted";
  setFollowingAuthorEverywhere(queryClient, userId, isFollowing);
  updateMatchingRecordsInEveryQuery(
    queryClient,
    (record) => record.id === userId && (typeof record.isFollowing === "boolean" || typeof record.followState === "string"),
    (user) => ({
      ...user,
      ...(typeof user.isFollowing === "boolean" ? { isFollowing } : {}),
      ...(typeof user.followState === "string" ? { followState: state } : {}),
      ...(typeof user.viewerPostNotifications === "string" && !isFollowing ? { viewerPostNotifications: "off" } : {}),
    }),
  );
}

export function setPostNotificationLevelEverywhere(queryClient: QueryClient, userId: string, level: PostNotificationLevel) {
  updateMatchingRecordsInEveryQuery(queryClient, (record) => record.id === userId && typeof record.viewerPostNotifications === "string", (user) => ({ ...user, viewerPostNotifications: level }));
}

export interface PostNotificationOption {
  readonly level: PostNotificationLevel;
  readonly label: string;
  readonly detail: string;
}

export const postNotificationOptions: readonly PostNotificationOption[] = [
  { level: "posts", label: "All posts", detail: "Posts and clips" },
  { level: "posts_and_lives", label: "Lives too", detail: "Also notify when they go live" },
  { level: "off", label: "Off", detail: "Only the usual notifications" },
];

export function postNotificationBellLabel(level: PostNotificationLevel, handle: string): string {
  if (level === "off") return `Post notifications off for @${handle}`;
  return level === "posts_and_lives" ? `Notifying you about posts and lives from @${handle}` : `Notifying you about posts from @${handle}`;
}

export function shouldShowPostNotificationBell(input: { readonly isSelf: boolean; readonly isSignedIn: boolean; readonly followState: FollowState }): boolean {
  return !input.isSelf && input.isSignedIn && input.followState === "accepted";
}
