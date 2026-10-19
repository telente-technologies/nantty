import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { setUserFollowStateEverywhere } from "@/cache/followCache.util";
import { ApiError } from "@/errors/api.error";
import { followsService } from "@/services/social/follows.service";
import { showDialog } from "@/store/dialog.store";
import { showToast } from "@/store/toast.store";
import type { FollowState } from "@/types/socialGraph.type";

export interface FollowToggleRequest {
  readonly subjectLabel: string;
  readonly state: FollowState | undefined;
  readonly followedState?: "requested" | "accepted";
  readonly follow: () => Promise<{ readonly state: FollowState } | void>;
  readonly unfollow: () => Promise<unknown>;
  readonly apply: (state: FollowState) => void;
  readonly onSettled?: () => void;
}

export const isActiveFollowState = (state: FollowState | undefined) => state === "accepted" || state === "requested";

export function unfollowConfirmCopy(subjectLabel: string, state: FollowState | undefined) {
  return state === "requested"
    ? { title: "Cancel follow request?", message: `${subjectLabel} won't see your request any more. You can ask again later.`, confirm: "Cancel request", keep: "Keep request" }
    : { title: `Unfollow ${subjectLabel}?`, message: "Their posts will no longer show up in your Following feed.", confirm: "Unfollow", keep: "Cancel" };
}

export function followToggleFailureMessage(error: unknown, attempted: FollowState, subjectLabel: string): string {
  if (error instanceof ApiError && error.code === "FOLLOW_REQUEST_COOLDOWN") return `You can ask to follow ${subjectLabel} again in a little while.`;
  return attempted === "none" ? `Couldn't unfollow ${subjectLabel}. Try again.` : `Couldn't follow ${subjectLabel}. Try again.`;
}

export function useConfirmedFollowToggle() {
  const busy = useRef(false);

  const run = useCallback(async (request: FollowToggleRequest, next: FollowState, action: () => Promise<{ readonly state: FollowState } | unknown>) => {
    const previous = request.state ?? "none";
    request.apply(next);
    try {
      const result = await action();
      const confirmed = (result as { state?: FollowState } | undefined)?.state;
      if (confirmed !== undefined && confirmed !== next) request.apply(confirmed);
    } catch (error) {
      request.apply(previous);
      showToast(followToggleFailureMessage(error, next, request.subjectLabel), { tone: "error" });
    } finally {
      busy.current = false;
      request.onSettled?.();
    }
  }, []);

  const toggle = useCallback((request: FollowToggleRequest) => {
    if (busy.current) return;
    busy.current = true;
    if (!isActiveFollowState(request.state)) return void run(request, request.followedState ?? "accepted", request.follow);
    const copy = unfollowConfirmCopy(request.subjectLabel, request.state);
    const release = () => {
      busy.current = false;
    };
    showDialog({
      title: copy.title,
      message: copy.message,
      intent: "unfollow",
      onDismiss: release,
      actions: [
        { label: copy.confirm, style: "destructive", onPress: () => void run(request, "none", request.unfollow) },
        { label: copy.keep, style: "secondary", onPress: release },
      ],
    });
  }, [run]);

  return { toggle, isBusy: () => busy.current };
}

export interface FollowableUser {
  readonly id: string;
  readonly username: string;
  readonly followState?: FollowState;
  readonly isPrivate?: boolean;
}

export function useFollowUserToggle() {
  const queryClient = useQueryClient();
  const { toggle, isBusy } = useConfirmedFollowToggle();
  const toggleUser = useCallback((user: FollowableUser, applyLocally?: (state: FollowState) => void) =>
    toggle({
      subjectLabel: `@${user.username}`,
      state: user.followState,
      followedState: user.isPrivate ? "requested" : "accepted",
      follow: () => followsService.followUser(user.id),
      unfollow: () => followsService.unfollowUser(user.id),
      apply: (state) => {
        setUserFollowStateEverywhere(queryClient, user.id, state);
        applyLocally?.(state);
      },
      onSettled: () => void queryClient.invalidateQueries({ queryKey: ["users", user.id] }),
    }), [queryClient, toggle]);
  return { toggleUser, isBusy };
}
