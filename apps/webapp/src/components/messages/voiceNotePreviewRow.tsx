"use client";

import { downsampleLevelsByBucketMax, formatVoiceNoteClock, voiceNoteBarCount } from "@zudomart/chat-crypto";
import { type Ref, useEffect, useMemo } from "react";

import { CloseIcon, SendIcon } from "@/components/ui/icons";

import { PlayPauseMorphIcon } from "./playPauseMorphIcon";
import { useVoiceNotePlayer } from "./voiceNotePlayer.hook";
import styles from "./voiceNote.module.css";
import { VoiceNoteScrubWaveform } from "./voiceNoteWaveformBars";

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export interface VoiceNotePreviewRowProps {
  readonly levels: readonly number[];
  readonly recordedSeconds: number;
  readonly previewFile: File | null;
  readonly playButtonRef: Ref<HTMLButtonElement>;
  readonly onDiscard: () => void;
  readonly onSend: () => void;
}

export function VoiceNotePreviewRow({ levels, recordedSeconds, previewFile, playButtonRef, onDiscard, onSend }: VoiceNotePreviewRowProps) {
  const source = useObjectUrl(previewFile);
  const player = useVoiceNotePlayer("composer-preview", source, recordedSeconds);
  const bars = useMemo(() => downsampleLevelsByBucketMax(levels, voiceNoteBarCount), [levels]);
  const finish = (action: () => void) => {
    player.pause();
    action();
  };
  return (
    <div className={styles.previewRow}>
      <button
        ref={playButtonRef}
        type="button"
        className={styles.playButton}
        disabled={!player.isReady}
        aria-label={player.isPlaying ? "Pause voice note" : `Play voice note, ${formatVoiceNoteClock(recordedSeconds)}`}
        onClick={player.toggle}
      >
        <PlayPauseMorphIcon isPlaying={player.isPlaying} />
      </button>
      <VoiceNoteScrubWaveform levels={bars} playedFraction={player.hasStarted ? player.playedFraction : 0} durationSeconds={player.durationSeconds} disabled={!player.isReady} onSeek={player.seekToFraction} />
      <span className={styles.clock} aria-hidden="true">{formatVoiceNoteClock(player.hasStarted ? player.currentTime : recordedSeconds)}</span>
      <button type="button" className={styles.iconButton} aria-label="Discard voice note" onClick={() => finish(onDiscard)}>
        <CloseIcon size={16} />
      </button>
      <button type="button" className={styles.sendButton} aria-label="Send voice note" disabled={!player.isReady} onClick={() => finish(onSend)}>
        <SendIcon size={18} />
      </button>
    </div>
  );
}
