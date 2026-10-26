"use client";

import { easeOutQuart, interpolatePlayPausePolygons, playPauseMorphMilliseconds, polygonPathData } from "@nantty/chat-crypto";
import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function usePlayPauseMorphProgress(isPlaying: boolean) {
  const target = isPlaying ? 1 : 0;
  const [progress, setProgress] = useState(target);
  const progressRef = useRef(target);
  useEffect(() => {
    if (progressRef.current === target || prefersReducedMotion()) {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    const from = progressRef.current;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = Math.min(1, (now - startedAt) / playPauseMorphMilliseconds);
      progressRef.current = from + (target - from) * easeOutQuart(elapsed);
      setProgress(progressRef.current);
      if (elapsed < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return progress;
}

export function PlayPauseMorphIcon({ isPlaying, size = 20 }: { readonly isPlaying: boolean; readonly size?: number }) {
  const [firstShape, secondShape] = interpolatePlayPausePolygons(usePlayPauseMorphProgress(isPlaying));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={polygonPathData(firstShape)} strokeLinejoin="round" />
      <path d={polygonPathData(secondShape)} strokeLinejoin="round" />
    </svg>
  );
}
