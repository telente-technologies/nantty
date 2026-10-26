"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvents, useRealtimeTopic } from "@nantty/web-kit/src/realtime/realtimeHooks";
import { useEffect, useRef } from "react";

import { webappRealtime } from "@/services/realtime/webappRealtime.service";
import type { LiveComment, LiveSessionDetails, Page } from "@/types";
import { prependLiveComment, readLiveViewerCount, readRealtimeLiveComment, removeLiveComment, shouldRefreshLiveComments, shouldRefreshLiveSession } from "@/utils/realtimeCache.util";

const coalesceMs = 500;

export function useLiveRoomRealtime(liveId: string, isWatching: boolean): boolean {
  const queryClient = useQueryClient();
  const isRealtime = useRealtimeTopic(webappRealtime, isWatching ? `live:${liveId}` : null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, [liveId]);

  const refreshSoon = (queryKey: readonly string[]) => {
    const key = queryKey.join("/");
    if (timers.current.has(key)) return;
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      void queryClient.invalidateQueries({ queryKey });
    }, coalesceMs));
  };

  useRealtimeEvents(webappRealtime, (event) => {
    const comment = readRealtimeLiveComment(event, liveId);
    if (comment) return void queryClient.setQueryData<Page<LiveComment>>(["live", liveId, "comments"], (page) => prependLiveComment(page, comment));
    if (event.type === "live.comment.deleted" && event.liveId === liveId && typeof event.commentId === "string") {
      const commentId = event.commentId;
      return void queryClient.setQueryData<Page<LiveComment>>(["live", liveId, "comments"], (page) => removeLiveComment(page, commentId));
    }
    const viewers = readLiveViewerCount(event, liveId);
    if (viewers !== null) return void queryClient.setQueryData<LiveSessionDetails>(["live", liveId], (live) => (live && live.viewers !== viewers ? { ...live, viewers } : live));
    if (shouldRefreshLiveSession(event, liveId)) refreshSoon(["live", liveId]);
    if (shouldRefreshLiveComments(event, liveId)) refreshSoon(["live", liveId, "comments"]);
  }, isWatching);

  return isRealtime;
}
