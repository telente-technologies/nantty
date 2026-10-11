"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { showToast } from "@/components/ui/toast";
import { followsService } from "@/services/posts.service";
import type { FollowState } from "@/types";
import { createFollowToggleRunner, setFollowStateEverywhere, type FollowConfirmationCopy } from "@/utils/followToggle.util";

export const confirmFollowChange = (copy: FollowConfirmationCopy) =>
  requestConfirmation({ ...copy, intent: "unfollow" });

interface UseFollowUserOptions {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly initialState: FollowState;
  readonly onStateChange?: (state: FollowState) => void;
}

export function useFollowUser({ userId, username, displayName, initialState, onStateChange }: UseFollowUserOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<FollowState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const stateRef = useRef(state);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    stateRef.current = initialState;
    setState(initialState);
  }, [initialState]);

  const runner = useMemo(() => createFollowToggleRunner({
    confirm: confirmFollowChange,
    follow: () => followsService.followUser(userId),
    unfollow: () => followsService.unfollowUser(userId),
    apply: (next) => {
      stateRef.current = next;
      setIsPending(true);
      setState(next);
      setFollowStateEverywhere(queryClient, userId, next);
      onStateChangeRef.current?.(next);
    },
    onFailed: () => showToast({ text: "Couldn't update follow. Try again.", tone: "error" }),
  }), [queryClient, userId]);

  const toggle = () => requireAuthThen(() => {
    if (runner.isBusy()) return;
    void runner.run(stateRef.current, username).finally(() => setIsPending(false));
  }, `Sign in to follow ${displayName}.`);

  const label = state === "accepted" ? "Following" : state === "requested" ? "Requested" : "Follow";
  return { state, isFollowing: state === "accepted", isActive: state === "accepted" || state === "requested", isPending, toggle, label };
}
