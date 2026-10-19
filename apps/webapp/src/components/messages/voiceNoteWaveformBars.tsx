"use client";

import { liveWaveformWindow, playedBarCount, seekFractionFromPosition, voiceNoteBarHeight } from "@zudomart/chat-crypto";
import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import styles from "./voiceNote.module.css";

export function VoiceNoteLiveWaveform({ levels, isCollapsing, opacity }: { readonly levels: readonly number[]; readonly isCollapsing: boolean; readonly opacity: number }) {
  const visibleSlots = liveWaveformWindow(levels);
  const firstSampleIndex = levels.length - visibleSlots.filter((slot) => slot !== null).length;
  let sampleOffset = 0;
  return (
    <div className={[styles.waveform, isCollapsing ? styles.waveformCollapsing : ""].join(" ")} style={{ opacity }} aria-hidden="true">
      {visibleSlots.map((level, slot) => {
        const key = level === null ? `empty-${slot}` : `sample-${firstSampleIndex + sampleOffset++}`;
        return <span key={key} className={[styles.bar, level === null ? "" : styles.barEntering].join(" ")} style={{ height: voiceNoteBarHeight(level) }} />;
      })}
    </div>
  );
}

export interface VoiceNoteScrubWaveformProps {
  readonly levels: readonly number[];
  readonly playedFraction: number;
  readonly durationSeconds: number;
  readonly disabled: boolean;
  readonly onSeek: (fraction: number) => void;
}

export function VoiceNoteScrubWaveform({ levels, playedFraction, durationSeconds, disabled, onSeek }: VoiceNoteScrubWaveformProps) {
  const isScrubbing = useRef(false);
  const played = playedBarCount(playedFraction, levels.length);
  const percent = Math.round(Math.min(1, Math.max(0, playedFraction)) * 100);
  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onSeek(seekFractionFromPosition(event.clientX - bounds.left, bounds.width));
  };
  const seekByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || durationSeconds <= 0) return;
    const step = Math.min(1, 5 / durationSeconds);
    const targets: Record<string, number> = { ArrowRight: playedFraction + step, ArrowUp: playedFraction + step, ArrowLeft: playedFraction - step, ArrowDown: playedFraction - step, Home: 0, End: 1 };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSeek(Math.min(1, Math.max(0, target)));
  };
  return (
    <div
      className={[styles.waveform, styles.scrub].join(" ")}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Voice note position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      aria-disabled={disabled}
      onKeyDown={seekByKeyboard}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        isScrubbing.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromPointer(event);
      }}
      onPointerMove={(event) => isScrubbing.current && seekFromPointer(event)}
      onPointerUp={() => {
        isScrubbing.current = false;
      }}
      onPointerCancel={() => {
        isScrubbing.current = false;
      }}
    >
      {levels.map((level, index) => (
        <span key={index} className={styles.bar} style={{ height: voiceNoteBarHeight(level), opacity: index < played ? 1 : 0.3 }} />
      ))}
    </div>
  );
}
