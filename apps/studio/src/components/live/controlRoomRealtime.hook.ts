"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvents, useRealtimeTopic } from "@nantty/web-kit/src/realtime/realtimeHooks";
import { useEffect, useRef } from "react";

import { studioRealtime } from "@/services/realtime/studioRealtime.service";
import type { LiveComment, LiveDetail } from "@/types";
import { applyViewerCount, prependComment, readControlRoomComment, readControlRoomRefreshes, removeComment, type ControlRoomRefresh } from "@/utils/realtimeLive.util";

const coalesceMs = 500;

export function useControlRoomRealtime(liveId: string, isActive: boolean): boolean {
  const queryClient = useQueryClient();
  const isRealtime = useRealtimeTopic(studioRealtime, isActive ? `live:${liveId}` : null);
  const timers = useRef(new Map<ControlRoomRefresh, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, [liveId]);

  const queryKeyFor: Record<ControlRoomRefresh, readonly string[]> = {
    live: ["live", liveId],
    comments: ["live-comments", liveId],
    guests: ["live-stage-guests", liveId],
    safety: ["live-safety", liveId],
  };

  useRealtimeEvents(studioRealtime, (event) => {
    const comment = readControlRoomComment(event, liveId);
    if (comment) return void queryClient.setQueryData<readonly LiveComment[]>(["live-comments", liveId], (comments) => prependComment(comments, comment));
    if (event.type === "live.comment.deleted" && event.liveId === liveId && typeof event.commentId === "string") {
      const commentId = event.commentId;
      return void queryClient.setQueryData<readonly LiveComment[]>(["live-comments", liveId], (comments) => removeComment(comments, commentId));
    }
    if (event.type === "live.viewerCount") return void queryClient.setQueryData<LiveDetail>(["live", liveId], (live) => applyViewerCount(live, event, liveId));
    for (const refresh of readControlRoomRefreshes(event, liveId)) {
      if (timers.current.has(refresh)) continue;
      timers.current.set(refresh, setTimeout(() => {
        timers.current.delete(refresh);
        void queryClient.invalidateQueries({ queryKey: queryKeyFor[refresh], exact: true });
      }, coalesceMs));
    }
  }, isActive);

  return isRealtime;
}
