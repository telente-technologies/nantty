"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { ARROW_SEEK_SECONDS, JUMP_SEEK_SECONDS, clampFraction, formatPlaybackTime, fractionFromPointer, isScrubbableDuration, secondsAtFraction } from "@/utils/videoSeek.util";

import styles from "./video.module.css";

export interface VideoSeekBarProps {
  readonly currentSeconds: number;
  readonly durationSeconds: number;
  readonly bufferedSeconds?: number;
  readonly variant?: "overlay" | "fullscreen";
  readonly canSeek?: boolean;
  readonly className?: string;
  readonly onScrubStart?: () => void;
  readonly onScrubPreview?: (seconds: number) => void;
  readonly onScrubEnd: (targetSeconds: number | null) => void;
  readonly onSeekBy: (deltaSeconds: number) => void;
}

export function VideoSeekBar({
  currentSeconds,
  durationSeconds,
  bufferedSeconds = 0,
  variant = "overlay",
  canSeek = true,
  className,
  onScrubStart,
  onScrubPreview,
  onScrubEnd,
  onSeekBy,
}: VideoSeekBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrubFraction = useRef<number | null>(null);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const isInteractive = canSeek && isScrubbableDuration(durationSeconds);
  const latestOnScrubEnd = useRef(onScrubEnd);
  useEffect(() => {
    latestOnScrubEnd.current = onScrubEnd;
  });

  useEffect(() => {
    if (isInteractive || scrubFraction.current === null) return;
    scrubFraction.current = null;
    latestOnScrubEnd.current(null);
  }, [isInteractive]);

  useEffect(() => () => {
    if (scrubFraction.current !== null) latestOnScrubEnd.current(null);
  }, []);

  const fractionAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect ? fractionFromPointer(clientX, rect.left, rect.width) : 0;
  };

  const updateScrub = (fraction: number) => {
    scrubFraction.current = fraction;
    setDragFraction(fraction);
    onScrubPreview?.(secondsAtFraction(fraction, durationSeconds));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onScrubStart?.();
    updateScrub(fractionAt(event.clientX));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const fraction = fractionAt(event.clientX);
    if (scrubFraction.current !== null) updateScrub(fraction);
    else if (isInteractive) setHoverFraction(fraction);
  };

  const finishScrub = (commit: boolean) => {
    const fraction = scrubFraction.current;
    if (fraction === null) return;
    scrubFraction.current = null;
    setDragFraction(null);
    onScrubEnd(commit ? secondsAtFraction(fraction, durationSeconds) : null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    const steps: Record<string, number> = {
      ArrowLeft: -ARROW_SEEK_SECONDS,
      ArrowDown: -ARROW_SEEK_SECONDS,
      ArrowRight: ARROW_SEEK_SECONDS,
      ArrowUp: ARROW_SEEK_SECONDS,
      PageDown: -JUMP_SEEK_SECONDS,
      PageUp: JUMP_SEEK_SECONDS,
      Home: -currentSeconds,
      End: durationSeconds - currentSeconds,
    };
    const delta = steps[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    onSeekBy(delta);
  };

  const playedFraction = dragFraction ?? (durationSeconds > 0 ? clampFraction(currentSeconds / durationSeconds) : 0);
  const bufferedFraction = durationSeconds > 0 ? Math.max(clampFraction(bufferedSeconds / durationSeconds), playedFraction) : 0;
  const shownSeconds = secondsAtFraction(playedFraction, durationSeconds);
  const tooltipFraction = dragFraction ?? hoverFraction;
  const tooltipText =
    dragFraction !== null
      ? `${formatPlaybackTime(shownSeconds)} / ${formatPlaybackTime(durationSeconds)}`
      : formatPlaybackTime(secondsAtFraction(hoverFraction ?? 0, durationSeconds));

  return (
    <div
      ref={trackRef}
      className={[styles.seekBar, variant === "fullscreen" ? styles.seekBarFullscreen : "", dragFraction !== null ? styles.seekBarActive : "", isInteractive ? "" : styles.seekBarStatic, className ?? ""].join(" ")}
      role="slider"
      tabIndex={isInteractive ? 0 : -1}
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSeconds)}
      aria-valuenow={Math.round(shownSeconds)}
      aria-valuetext={`${formatPlaybackTime(shownSeconds)} of ${formatPlaybackTime(durationSeconds)}`}
      aria-disabled={!isInteractive}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => finishScrub(true)}
      onPointerCancel={() => finishScrub(false)}
      onPointerLeave={() => setHoverFraction(null)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.seekTrack}>
        <div className={styles.seekBuffered} style={{ width: `${bufferedFraction * 100}%` }} />
        <div className={styles.seekPlayed} style={{ width: `${playedFraction * 100}%` }} />
      </div>
      {isInteractive ? <div className={styles.seekThumb} style={{ left: `${playedFraction * 100}%` }} /> : null}
      {isInteractive && tooltipFraction !== null ? (
        <div className={styles.seekTooltip} style={{ left: `clamp(48px, ${tooltipFraction * 100}%, calc(100% - 48px))` }} aria-hidden="true">
          {tooltipText}
        </div>
      ) : null}
    </div>
  );
}
