"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";

import { SearchScopeRegistrar } from "@/components/search/searchScopeRegistrar";
import {
  dragOffsetWithEdgeResistance,
  homeSections,
  isHorizontalSectionSwipe,
  resolveSectionIndexAfterRelease,
  sectionIndexOf,
} from "@/utils/homeSectionSwipe.util";

import { useHomeSection } from "./homeSection.context";
import { HomeSectionTabs } from "./homeSectionTabs";
import styles from "./homeSectionPager.module.css";

const IGNORE_SWIPE_SELECTOR = "[data-swipe-ignore], input, textarea, select, [contenteditable=true]";

function isInsideHorizontalScroller(target: Element, boundary: Element | null): boolean {
  for (let element: Element | null = target; element && element !== boundary; element = element.parentElement) {
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const overflowX = window.getComputedStyle(element).overflowX;
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}

export function HomeSectionPager({ feed, mart }: { readonly feed: ReactNode; readonly mart: ReactNode }) {
  const { activeSection, selectSection } = useHomeSection();
  const [hasOpenedMart, setHasOpenedMart] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClick = useRef(false);
  const gesture = useRef({ pointerId: -1, startX: 0, startY: 0, lastX: 0, lastTime: 0, velocity: 0, phase: "idle" as "idle" | "pending" | "dragging" | "abandoned" });

  const paintOffset = useCallback((offsetPixels: number | null) => {
    const track = trackRef.current;
    if (!track) return;
    if (offsetPixels === null) track.style.removeProperty("--pager-drag-x");
    else track.style.setProperty("--pager-drag-x", `${offsetPixels}px`);
    const width = viewportRef.current?.clientWidth || 1;
    const pager = track.parentElement?.parentElement;
    if (offsetPixels === null) pager?.style.removeProperty("--pager-position");
    else pager?.style.setProperty("--pager-position", String(-offsetPixels / width));
  }, []);

  useEffect(() => {
    if (activeSection === "mart") setHasOpenedMart(true);
  }, [activeSection]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (event.pointerType === "mouse" || target.closest(IGNORE_SWIPE_SELECTOR) || isInsideHorizontalScroller(target, event.currentTarget)) return;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, phase: "pending" };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.pointerId !== event.pointerId || state.phase === "idle" || state.phase === "abandoned") return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.phase === "pending") {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
        state.phase = "abandoned";
        return;
      }
      if (!isHorizontalSectionSwipe(dx, dy)) return;
      state.phase = "dragging";
      setIsDragging(true);
      setHasOpenedMart(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const elapsed = Math.max(1, event.timeStamp - state.lastTime);
    state.velocity = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastTime = event.timeStamp;
    const width = viewportRef.current?.clientWidth ?? window.innerWidth;
    paintOffset(dragOffsetWithEdgeResistance(sectionIndexOf(activeSection), dx, width));
  };

  const finishGesture = (event: PointerEvent<HTMLDivElement>, isCancelled: boolean) => {
    const state = gesture.current;
    if (state.pointerId !== event.pointerId) return;
    const wasDragging = state.phase === "dragging";
    gesture.current = { ...state, pointerId: -1, phase: "idle" };
    if (!wasDragging) return;
    suppressNextClick.current = true;
    window.setTimeout(() => (suppressNextClick.current = false), 400);
    setIsDragging(false);
    paintOffset(null);
    if (isCancelled) return;
    const width = viewportRef.current?.clientWidth ?? window.innerWidth;
    const nextIndex = resolveSectionIndexAfterRelease(sectionIndexOf(activeSection), event.clientX - state.startX, state.velocity, width);
    selectSection(homeSections[nextIndex] ?? activeSection);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressNextClick.current) return;
    suppressNextClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const activeIndex = sectionIndexOf(activeSection);
  return (
    <div className={styles.pager} style={{ "--pager-active-index": activeIndex } as CSSProperties} data-dragging={isDragging || undefined}>
      {activeSection === "mart" ? <SearchScopeRegistrar scope="mart" label="Mart" /> : null}
      <HomeSectionTabs desktopOnly />
      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishGesture(event, false)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onClickCapture={onClickCapture}
      >
        <div ref={trackRef} className={styles.track}>
          {homeSections.map((section) => (
            <section
              key={section}
              id={`home-section-panel-${section}`}
              role="tabpanel"
              aria-labelledby={`home-section-tab-${section} mobile-home-section-tab-${section}`}
              className={styles.panel}
              data-active={activeSection === section || undefined}
              inert={activeSection !== section && !isDragging ? true : undefined}
            >
              {section === "feed" ? feed : hasOpenedMart ? mart : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
