"use client";

import { useEffect, useRef, type RefObject } from "react";

import { useFeedInteractions } from "@/components/feed/interactions/feedInteractions.hook";
import type { FeedInteractionTarget } from "@/utils/feedInteractionQueue.util";
import { advanceClipWatchSession, createClipWatchSession, markClipWatchSeek, summarizeClipWatchSession } from "@/utils/clipWatchSession.util";
import { IMPRESSION_MINIMUM_VISIBLE_MS } from "@/utils/impressionSession.util";
import { consumeUserSeekFlag } from "@/components/video/videoPlayback.hook";

const SURFACE = "clips" as const;

export function useClipWatchTracking(videoRef: RefObject<HTMLVideoElement | null>, target: FeedInteractionTarget, isActive: boolean, fallbackDurationSeconds: number) {
  const { service, viewerId } = useFeedInteractions();
  const latest = useRef({ target, fallbackDurationSeconds });
  useEffect(() => {
    latest.current = { target, fallbackDurationSeconds };
  });

  useEffect(() => {
    if (!isActive || !viewerId) return;
    let session = createClipWatchSession();
    let activeSince: number | null = null;
    let viewTimer: number | null = null;
    const durationSeconds = () => {
      const duration = videoRef.current?.duration;
      return duration && Number.isFinite(duration) ? duration : latest.current.fallbackDurationSeconds;
    };
    const start = () => {
      session = createClipWatchSession();
      activeSince = Date.now();
      viewTimer = window.setTimeout(() => service.recordViewOncePerSession(latest.current.target, SURFACE), IMPRESSION_MINIMUM_VISIBLE_MS);
    };
    const finish = () => {
      if (viewTimer !== null) window.clearTimeout(viewTimer);
      viewTimer = null;
      const startedAt = activeSince;
      activeSince = null;
      if (startedAt === null || Date.now() - startedAt < IMPRESSION_MINIMUM_VISIBLE_MS) return;
      service.recordDwell(latest.current.target, SURFACE, Date.now() - startedAt);
      service.recordClipWatch(latest.current.target, SURFACE, summarizeClipWatchSession(session, durationSeconds()));
    };
    const onTimeUpdate = () => {
      const video = videoRef.current;
      if (video && activeSince !== null) advanceClipWatchSession(session, video.currentTime, durationSeconds());
    };
    const onSeeking = () => {
      const video = videoRef.current;
      if (video && consumeUserSeekFlag(video)) markClipWatchSeek(session, video.currentTime);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") finish();
      else if (activeSince === null) start();
    };
    const video = videoRef.current;
    video?.addEventListener("timeupdate", onTimeUpdate);
    video?.addEventListener("seeking", onSeeking);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", finish);
    start();
    return () => {
      video?.removeEventListener("timeupdate", onTimeUpdate);
      video?.removeEventListener("seeking", onSeeking);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finish);
      finish();
    };
  }, [isActive, viewerId, target.postId, service, videoRef]);
}
