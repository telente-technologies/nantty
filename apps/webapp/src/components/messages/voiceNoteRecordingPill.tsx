"use client";

import { type VoiceNoteSession, formatVoiceNoteClock, slideToCancelAppearance } from "@zudomart/chat-crypto";
import type { Ref } from "react";

import { CloseIcon, SendIcon, StopIcon } from "@/components/ui/icons";

import styles from "./voiceNote.module.css";
import { VoiceNotePreviewRow } from "./voiceNotePreviewRow";
import { VoiceNoteLiveWaveform } from "./voiceNoteWaveformBars";

export interface VoiceNoteRecordingPillProps {
  readonly session: VoiceNoteSession;
  readonly previewFile: File | null;
  readonly playButtonRef: Ref<HTMLButtonElement>;
  readonly stopButtonRef: Ref<HTMLButtonElement>;
  readonly onStop: () => void;
  readonly onStopAndSend: () => void;
  readonly onDiscard: () => void;
  readonly onSendPreview: () => void;
}

export const holdRecordingAnnouncement = "Recording. Release to keep, slide left or press Escape to discard.";

export function VoiceNoteRecordingPill({ session, previewFile, playButtonRef, stopButtonRef, onStop, onStopAndSend, onDiscard, onSendPreview }: VoiceNoteRecordingPillProps) {
  const appearance = slideToCancelAppearance(session.dragLeftPx);
  const isHandsFree = session.mode === "tap";
  const isHoldRecording = session.phase === "recording" && !isHandsFree;
  const isDiscarding = session.phase === "discarding";
  return (
    <>
      {isHoldRecording ? (
        <span className={[styles.hint, appearance.isArmed ? styles.hintArmed : ""].join(" ")} aria-hidden="true">
          {appearance.isArmed ? "Release to cancel" : "‹ Slide to cancel"}
        </span>
      ) : null}
      <div className={styles.pill}>
        {session.phase === "preview" ? (
          <VoiceNotePreviewRow levels={session.levels} recordedSeconds={session.elapsedMs / 1000} previewFile={previewFile} playButtonRef={playButtonRef} onDiscard={onDiscard} onSend={onSendPreview} />
        ) : (
          <div
            className={[styles.recordingRow, isHandsFree ? styles.recordingRowHandsFree : ""].join(" ")}
            style={{ opacity: appearance.rowOpacity, transform: `translateX(${appearance.rowTranslateX}px)` }}
          >
            <span className="visuallyHidden" role="status">
              {isDiscarding ? "Voice note discarded." : isHandsFree ? "Recording hands-free. Press Escape to discard." : holdRecordingAnnouncement}
            </span>
            <span className={styles.status} style={{ opacity: appearance.statusOpacity }} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.clock}>{formatVoiceNoteClock(session.elapsedMs / 1000)}</span>
            </span>
            <VoiceNoteLiveWaveform levels={session.levels} isCollapsing={isDiscarding} opacity={appearance.waveformOpacity} />
            {isHandsFree ? (
              <>
                <button ref={stopButtonRef} type="button" className={styles.stopButton} aria-label="Stop recording and listen" disabled={isDiscarding} onClick={onStop}>
                  <StopIcon size={16} />
                </button>
                <button type="button" className={styles.sendButton} aria-label="Send voice note" disabled={isDiscarding} onClick={onStopAndSend}>
                  <SendIcon size={18} />
                </button>
              </>
            ) : null}
          </div>
        )}
        {isHoldRecording && appearance.isArmed ? (
          <span className={styles.cancelBadge} aria-hidden="true">
            <CloseIcon size={16} />
          </span>
        ) : null}
      </div>
    </>
  );
}
