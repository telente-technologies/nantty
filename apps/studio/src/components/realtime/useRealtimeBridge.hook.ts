"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

import { studioRealtime } from "@/services/realtime/studioRealtime.service";
import { isCommentNotification } from "@/utils/realtimeLive.util";

export const unreadNotificationsQueryKey = ["notifications", "unread-count"] as const;
const coalesceMs = 500;

export function useRealtimeBridge(viewerId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!viewerId) return;
    const pending = new Map<string, QueryKey>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = (keys: readonly QueryKey[]) => {
      keys.forEach((key) => pending.set(JSON.stringify(key), key));
      timer ??= setTimeout(() => {
        timer = null;
        const keysToRefresh = [...pending.values()];
        pending.clear();
        keysToRefresh.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
      }, coalesceMs);
    };
    let wasLive = studioRealtime.status() === "live";
    const stopStatus = studioRealtime.onChange(() => {
      const isLive = studioRealtime.status() === "live";
      if (isLive && !wasLive) refreshSoon([unreadNotificationsQueryKey, ["my-post-comments"]]);
      wasLive = isLive;
    });
    const stopEvents = studioRealtime.subscribe((event) => {
      if (event.type !== "notification.created") return;
      queryClient.setQueryData<number>(unreadNotificationsQueryKey, (count) => (count === undefined ? count : count + 1));
      refreshSoon(isCommentNotification(event) ? [unreadNotificationsQueryKey, ["my-post-comments"], ["my-posts"]] : [unreadNotificationsQueryKey]);
    });
    studioRealtime.setEnabled(true);
    return () => {
      stopEvents();
      stopStatus();
      studioRealtime.setEnabled(false);
      if (timer) clearTimeout(timer);
    };
  }, [viewerId, queryClient]);
}
