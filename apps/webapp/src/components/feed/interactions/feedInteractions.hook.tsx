"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { feedInteractionsService } from "@/services/feedInteractions.service";
import type { FeedInteractionSurface, FeedInteractionTarget } from "@/utils/feedInteractionQueue.util";
import { advanceImpressionSession, createImpressionSession, endImpressionSession, type ImpressionStep } from "@/utils/impressionSession.util";

const PostSurfaceContext = createContext<FeedInteractionSurface>("feed");
const OBSERVER_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];
const TICK_MS = 250;

export function PostSurfaceProvider({ surface, children }: { readonly surface: FeedInteractionSurface; readonly children: ReactNode }) {
  return <PostSurfaceContext.Provider value={surface}>{children}</PostSurfaceContext.Provider>;
}

export const usePostSurface = () => useContext(PostSurfaceContext);

export function useFeedInteractions() {
  const { viewer } = useSession();
  const viewerId = viewer?.id ?? null;
  useEffect(() => feedInteractionsService.setViewer(viewerId), [viewerId]);
  return { service: feedInteractionsService, viewerId };
}

function visibleFractionOfEntry(entry: IntersectionObserverEntry): number {
  const rootHeight = entry.rootBounds?.height ?? window.innerHeight;
  const ofViewport = rootHeight > 0 ? entry.intersectionRect.height / rootHeight : 0;
  return Math.max(entry.intersectionRatio, ofViewport);
}

export function usePostImpressionRef(target: FeedInteractionTarget | null, surface: FeedInteractionSurface, position?: number) {
  const { viewerId } = useFeedInteractions();
  const latest = useRef({ target, surface, position });
  useEffect(() => {
    latest.current = { target, surface, position };
  });
  const cleanup = useRef<(() => void) | null>(null);
  const postId = target?.postId ?? null;

  const ref = useCallback(
    (element: HTMLElement | null) => {
      cleanup.current?.();
      cleanup.current = null;
      if (!element || !postId || !viewerId || typeof IntersectionObserver === "undefined") return;
      const session = createImpressionSession();
      let fraction = 0;
      const apply = (step: ImpressionStep) => {
        const current = latest.current;
        if (!step || !current.target) return;
        if (step.kind === "view") feedInteractionsService.recordViewOncePerSession(current.target, current.surface, current.position);
        else feedInteractionsService.recordDwell(current.target, current.surface, step.dwellMs, current.position);
      };
      const tick = () => apply(advanceImpressionSession(session, document.visibilityState === "visible" ? fraction : 0, Date.now()));
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) fraction = entry.isIntersecting ? visibleFractionOfEntry(entry) : 0;
        tick();
      }, { threshold: OBSERVER_THRESHOLDS });
      observer.observe(element);
      const timer = window.setInterval(() => {
        if (fraction > 0 || session.visibleSince !== null) tick();
      }, TICK_MS);
      cleanup.current = () => {
        observer.disconnect();
        window.clearInterval(timer);
        apply(endImpressionSession(session, Date.now()));
      };
    },
    [postId, viewerId],
  );

  useEffect(() => () => cleanup.current?.(), []);
  return ref;
}
