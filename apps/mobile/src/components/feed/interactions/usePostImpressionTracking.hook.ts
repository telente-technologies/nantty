import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef } from "react";
import { AppState, Dimensions, type View } from "react-native";

import { feedInteractionsService, type FeedInteractionSurface, type FeedInteractionTarget } from "@/services/feed/feedInteractions.service";
import { useAuthStore } from "@/store/auth.store";
import { advanceImpressionSession, createImpressionSession, endImpressionSession, visibleFractionOf, type ImpressionStep } from "@/utils/impressionSession.util";

const TICK_INTERVAL_MS = 250;

type Tracker = { readonly measure: (now: number) => void; readonly end: (now: number) => void };

const activeTrackers = new Set<Tracker>();
let ticker: ReturnType<typeof setInterval> | null = null;
let isAppActive = AppState.currentState === "active";

function syncTicker() {
  const shouldRun = isAppActive && activeTrackers.size > 0;
  if (shouldRun && !ticker) ticker = setInterval(() => activeTrackers.forEach((tracker) => tracker.measure(Date.now())), TICK_INTERVAL_MS);
  if (!shouldRun && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

AppState.addEventListener("change", (state) => {
  isAppActive = state === "active";
  if (!isAppActive) activeTrackers.forEach((tracker) => tracker.end(Date.now()));
  syncTicker();
});

export function usePostImpressionTracking(target: FeedInteractionTarget | null, surface: FeedInteractionSurface, position?: number) {
  const ref = useRef<View>(null);
  const isFocused = useIsFocused();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const latest = useRef({ target, surface, position });
  useEffect(() => {
    latest.current = { target, surface, position };
  });
  const postId = target?.postId;

  useEffect(() => {
    if (!postId || !isFocused || !isSignedIn) return;
    const session = createImpressionSession();
    const apply = (step: ImpressionStep) => {
      const current = latest.current;
      if (!step || !current.target) return;
      if (step.kind === "view") feedInteractionsService.recordViewOncePerSession(current.target, current.surface, current.position);
      else feedInteractionsService.recordDwell(current.target, current.surface, step.dwellMs, current.position);
    };
    const tracker: Tracker = {
      measure: (now) =>
        ref.current?.measureInWindow((x, y, width, height) => {
          if (!activeTrackers.has(tracker)) return;
          apply(advanceImpressionSession(session, visibleFractionOf({ x, y, width, height }, Dimensions.get("window")), now));
        }),
      end: (now) => apply(endImpressionSession(session, now)),
    };
    activeTrackers.add(tracker);
    syncTicker();
    return () => {
      activeTrackers.delete(tracker);
      tracker.end(Date.now());
      syncTicker();
    };
  }, [postId, isFocused, isSignedIn]);

  return ref;
}
