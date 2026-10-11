import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { feedInteractionsService, type FeedInteractionTarget } from "@/services/feed/feedInteractions.service";
import { advanceClipWatchSession, createClipWatchSession, markClipWatchSeek, summarizeClipWatchSession } from "@/utils/clipWatchSession.util";
import { IMPRESSION_MINIMUM_VISIBLE_MS } from "@/utils/impressionSession.util";

const SURFACE = "clips" as const;

export function useClipWatchTracking(target: FeedInteractionTarget, isActive: boolean, currentSeconds: number, durationSeconds: number) {
  const session = useRef(createClipWatchSession());
  const activeSince = useRef<number | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ target, durationSeconds });
  useEffect(() => {
    latest.current = { target, durationSeconds };
  });

  useEffect(() => {
    if (isActive && activeSince.current !== null) advanceClipWatchSession(session.current, currentSeconds, durationSeconds);
  }, [isActive, currentSeconds, durationSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const start = () => {
      session.current = createClipWatchSession();
      activeSince.current = Date.now();
      viewTimer.current = setTimeout(() => feedInteractionsService.recordViewOncePerSession(latest.current.target, SURFACE), IMPRESSION_MINIMUM_VISIBLE_MS);
    };
    const finish = () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
      viewTimer.current = null;
      const startedAt = activeSince.current;
      activeSince.current = null;
      if (startedAt === null) return;
      const visibleMs = Date.now() - startedAt;
      if (visibleMs < IMPRESSION_MINIMUM_VISIBLE_MS) return;
      const { target: current, durationSeconds: duration } = latest.current;
      feedInteractionsService.recordDwell(current, SURFACE, visibleMs);
      feedInteractionsService.recordClipWatch(current, SURFACE, summarizeClipWatchSession(session.current, duration));
    };
    start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (activeSince.current === null) start();
      } else finish();
    });
    return () => {
      subscription.remove();
      finish();
    };
  }, [isActive, target.postId]);

  return useCallback((targetSeconds: number) => markClipWatchSeek(session.current, targetSeconds), []);
}
