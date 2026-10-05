"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { PauseIcon, PlayIcon } from "@/components/ui/icons";
import type { MartHighlight } from "@/types/martHighlight.type";

import styles from "./martHighlightsCarousel.module.css";

export const MART_CAROUSEL_AUTO_ADVANCE_MS = 5000;

const hrefForHighlight = ({ target }: MartHighlight) =>
  target.type === "collection" ? `/collections/${target.collection}` : `/category/${encodeURIComponent(target.categoryId)}`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useOnScreenAndTabVisible(element: HTMLElement | null) {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true), { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return onScreen && tabVisible;
}

export function MartHighlightsCarousel({ highlights, loading }: { readonly highlights: readonly MartHighlight[]; readonly loading: boolean }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const visible = useOnScreenAndTabVisible(root);
  const count = highlights.length;
  const highlightIds = highlights.map((highlight) => highlight.id).join("|");

  useEffect(() => {
    setIndex(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [highlightIds]);

  const goTo = useCallback((requested: number) => {
    const track = trackRef.current;
    if (!track || count === 0) return;
    const target = (requested + count) % count;
    track.scrollTo({ left: target * track.clientWidth, behavior: reducedMotion || target === 0 ? "auto" : "smooth" });
    setIndex(target);
  }, [count, reducedMotion]);

  const autoAdvance = visible && !interacting && !userPaused && !reducedMotion && count > 1;
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => goTo(index + 1), MART_CAROUSEL_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, index, goTo]);

  if (count === 0) return loading ? <div className={styles.placeholder} aria-busy="true" aria-label="Loading highlights" /> : null;

  return (
    <section
      ref={setRoot}
      className={styles.carousel}
      aria-roledescription="carousel"
      aria-label="Highlights for you"
      onPointerEnter={() => setInteracting(true)}
      onPointerLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}
    >
      <div
        ref={trackRef}
        className={styles.track}
        aria-live={autoAdvance ? "off" : "polite"}
        onPointerDown={() => setInteracting(true)}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (track.clientWidth > 0) setIndex(Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
        }}
      >
        {highlights.map((highlight, slideIndex) => (
          <Link
            key={highlight.id}
            href={hrefForHighlight(highlight)}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} of ${count}: ${highlight.title}. ${highlight.ranking.reason.label}`}
            tabIndex={slideIndex === index ? 0 : -1}
          >
            {highlight.imageUrl ? <img src={highlight.imageUrl} alt="" className={styles.image} loading={slideIndex === 0 ? "eager" : "lazy"} /> : null}
            <span className={styles.caption}>
              <span className={styles.title}>{highlight.title}</span>
              <span className={styles.reason}>{highlight.ranking.reason.label}</span>
            </span>
          </Link>
        ))}
      </div>
      {count > 1 ? (
        <div className={styles.controls}>
          {reducedMotion ? null : (
            <button type="button" className={styles.pause} onClick={() => setUserPaused((paused) => !paused)} aria-label={userPaused ? "Play highlights" : "Pause highlights"}>
              {userPaused ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
            </button>
          )}
          {highlights.map((highlight, dotIndex) => (
            <button
              key={highlight.id}
              type="button"
              className={[styles.dot, dotIndex === index ? styles.dotActive : ""].join(" ")}
              aria-label={`Show highlight ${dotIndex + 1} of ${count}`}
              aria-current={dotIndex === index ? "true" : undefined}
              onClick={() => goTo(dotIndex)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
