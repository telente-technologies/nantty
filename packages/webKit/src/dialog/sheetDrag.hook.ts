"use client";

import { useRef, type PointerEvent } from "react";

const dismissDistance = 96;
const dismissVelocity = 0.9;
const smallScreenQuery = "(max-width: 767px)";

interface DragStart {
  readonly y: number;
  readonly time: number;
  readonly panel: HTMLElement;
}

export function shouldDismissSheetDrag(offset: number, elapsedMilliseconds: number): boolean {
  const velocity = offset / Math.max(1, elapsedMilliseconds);
  return offset > dismissDistance || (offset > 24 && velocity > dismissVelocity);
}

export function useSheetDragToClose(enabled: boolean, onClose: () => void, classes: { readonly dragging?: string; readonly settling?: string }) {
  const start = useRef<DragStart | null>(null);
  const offset = useRef(0);
  const dragging = classes.dragging ?? "";
  const settling = classes.settling ?? "";

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || !window.matchMedia(smallScreenQuery).matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    const panel = event.currentTarget.closest<HTMLElement>("[data-sheet-panel]");
    if (!panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { y: event.clientY, time: event.timeStamp, panel };
    offset.current = 0;
    if (settling) panel.classList.remove(settling);
    if (dragging) panel.classList.add(dragging);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    offset.current = Math.max(0, event.clientY - start.current.y);
    start.current.panel.style.transform = `translateY(${offset.current}px)`;
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const drag = start.current;
    if (!drag) return;
    start.current = null;
    if (dragging) drag.panel.classList.remove(dragging);
    const shouldClose = shouldDismissSheetDrag(offset.current, event.timeStamp - drag.time);
    offset.current = 0;
    if (shouldClose) {
      onClose();
      return;
    }
    if (settling) drag.panel.classList.add(settling);
    drag.panel.style.transform = "";
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
