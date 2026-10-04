"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const ACTIVATION_OFFSET_X = 18;
const FAIL_OFFSET_Y = 12;
const COMMIT_WIDTH_RATIO = 0.28;
const COMMIT_VELOCITY_PX_PER_MS = 0.8;
const MINIMUM_DISTANCE_FOR_VELOCITY_COMMIT = 48;
const MAXIMUM_DRAG_RATIO = 0.45;
const IGNORE_SELECTOR = "[data-swipe-ignore]";
const CLICK_SUPPRESSION_MS = 400;

type GesturePhase = "idle" | "pending" | "dragging" | "abandoned";

interface PostSwipeOptions {
  readonly enabled: boolean;
  readonly isLiked: boolean;
  readonly onLike: () => void;
  readonly onOpenComments: () => void;
}

function useCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isCoarse;
}

export function usePostSwipe({ enabled, isLiked, onLike, onOpenComments }: PostSwipeOptions) {
  const isCoarsePointer = useCoarsePointer();
  const isActive = enabled && isCoarsePointer;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef({ phase: "idle" as GesturePhase, pointerId: -1, startX: 0, startY: 0, lastX: 0, lastTime: 0, velocity: 0, crossed: false });
  const shouldSuppressClick = useRef(false);
  const latest = useRef({ isLiked, onLike, onOpenComments });
  useEffect(() => {
    latest.current = { isLiked, onLike, onOpenComments };
  });

  const paint = (offset: number, width: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const distance = width * COMMIT_WIDTH_RATIO;
    frame.style.setProperty("--swipe-x", `${offset}px`);
    frame.style.setProperty("--swipe-like", String(Math.min(1, Math.max(0, offset / distance))));
    frame.style.setProperty("--swipe-reply", String(Math.min(1, Math.max(0, -offset / distance))));
  };

  const settle = () => {
    frameRef.current?.setAttribute("data-swipe-settling", "true");
    paint(0, frameRef.current?.clientWidth ?? 1);
    gesture.current.phase = "idle";
    gesture.current.crossed = false;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isActive || event.pointerType === "mouse" || !event.isPrimary) return;
    if ((event.target as Element).closest(IGNORE_SELECTOR)) return;
    gesture.current = { phase: "pending", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, crossed: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (event.pointerId !== state.pointerId || state.phase === "idle" || state.phase === "abandoned") return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.phase === "pending") {
      if (Math.abs(dy) > FAIL_OFFSET_Y && Math.abs(dy) >= Math.abs(dx)) state.phase = "abandoned";
      else if (Math.abs(dx) > ACTIVATION_OFFSET_X && Math.abs(dy) < FAIL_OFFSET_Y) {
        state.phase = "dragging";
        frameRef.current?.removeAttribute("data-swipe-settling");
        frameRef.current?.setPointerCapture(event.pointerId);
      }
      if (state.phase !== "dragging") return;
    }
    const width = frameRef.current?.clientWidth ?? 1;
    const limit = width * MAXIMUM_DRAG_RATIO;
    const offset = Math.max(-limit, Math.min(limit, dx - Math.sign(dx) * ACTIVATION_OFFSET_X));
    const elapsed = Math.max(1, event.timeStamp - state.lastTime);
    state.velocity = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastTime = event.timeStamp;
    const crossed = Math.abs(offset) >= width * COMMIT_WIDTH_RATIO && !(offset > 0 && latest.current.isLiked);
    if (crossed && !state.crossed) navigator.vibrate?.(8);
    state.crossed = crossed;
    paint(offset, width);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (event.pointerId !== state.pointerId) return;
    if (state.phase !== "dragging") {
      state.phase = "idle";
      return;
    }
    const width = frameRef.current?.clientWidth ?? 1;
    const offset = event.clientX - state.startX - Math.sign(event.clientX - state.startX) * ACTIVATION_OFFSET_X;
    const flung = Math.abs(state.velocity) > COMMIT_VELOCITY_PX_PER_MS && Math.abs(offset) > MINIMUM_DISTANCE_FOR_VELOCITY_COMMIT;
    const committed = Math.abs(offset) >= width * COMMIT_WIDTH_RATIO || flung;
    shouldSuppressClick.current = true;
    window.setTimeout(() => (shouldSuppressClick.current = false), CLICK_SUPPRESSION_MS);
    settle();
    if (!committed) return;
    if (offset > 0) {
      if (!latest.current.isLiked) latest.current.onLike();
    } else latest.current.onOpenComments();
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === gesture.current.pointerId) settle();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!shouldSuppressClick.current) return;
    shouldSuppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    isActive,
    frameRef,
    frameHandlers: isActive ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture } : {},
  };
}
