"use client";

import { formatVoiceNoteClock, formatVoiceNotePlaybackRate, voiceNoteDisplayLevels } from "@zudomart/chat-crypto";
import { type CSSProperties, useMemo } from "react";

import { PlayPauseMorphIcon } from "./playPauseMorphIcon";
import { useVoiceNotePlayer } from "./voiceNotePlayer.hook";
import styles from "./voiceNote.module.css";
import { VoiceNoteScrubWaveform } from "./voiceNoteWaveformBars";

export interface VoiceNoteBubbleProps {
  readonly mediaId: string;
  readonly source: string | null;
  readonly durationSeconds: number;
  readonly waveformPeaks: readonly number[] | null | undefined;
  readonly isMine: boolean;
}

export function VoiceNoteBubble({ mediaId, source, durationSeconds, waveformPeaks, isMine }: VoiceNoteBubbleProps) {
  const player = useVoiceNotePlayer(`voice-note-${mediaId}`, source, durationSeconds);
  const bars = useMemo(() => voiceNoteDisplayLevels(waveformPeaks, mediaId), [mediaId, waveformPeaks]);
  const surface = { "--voice-bubble-surface": isMine ? "var(--color-brand-solid)" : "var(--surface-card)", "--voice-card": isMine ? "var(--color-brand-solid)" : "var(--surface-card)" } as CSSProperties;
  return (
    <div className={styles.bubble} style={surface}>
      <button
        type="button"
        className={styles.bubblePlay}
        disabled={!player.isReady}
        aria-label={player.isPlaying ? "Pause voice note" : `Play voice note, ${formatVoiceNoteClock(player.durationSeconds)}`}
        onClick={player.toggle}
      >
        <PlayPauseMorphIcon isPlaying={player.isPlaying} size={18} />
      </button>
      <VoiceNoteScrubWaveform levels={bars} playedFraction={player.hasStarted ? player.playedFraction : 0} durationSeconds={player.durationSeconds} disabled={!player.isReady} onSeek={player.seekToFraction} />
      <span className={styles.bubbleClock} aria-hidden="true">{formatVoiceNoteClock(player.hasStarted ? player.currentTime : player.durationSeconds)}</span>
      <button type="button" className={styles.speedChip} aria-label={`Playback speed ${formatVoiceNotePlaybackRate(player.playbackRate)}`} onClick={player.cyclePlaybackRate}>
        {formatVoiceNotePlaybackRate(player.playbackRate)}
      </button>
    </div>
  );
}
