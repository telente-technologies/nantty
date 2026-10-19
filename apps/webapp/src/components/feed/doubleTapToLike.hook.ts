"use client";

import { useRef, type PointerEvent } from "react";

const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 30;

export function useDoubleTapToLike(onDoubleTap: () => void) {
  const lastTap = useRef({ time: 0, x: 0, y: 0 });
  return {
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const previous = lastTap.current;
      const isSecondTap = event.timeStamp - previous.time < DOUBLE_TAP_WINDOW_MS && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < DOUBLE_TAP_MAX_DISTANCE_PX;
      if (isSecondTap) {
        lastTap.current = { time: 0, x: 0, y: 0 };
        event.preventDefault();
        onDoubleTap();
        return;
      }
      lastTap.current = { time: event.timeStamp, x: event.clientX, y: event.clientY };
    },
  };
}
