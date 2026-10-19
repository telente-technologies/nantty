"use client";

import { isVoiceNoteSessionActive } from "@zudomart/chat-crypto";
import { useEffect, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MicrophoneIcon } from "@/components/ui/icons";
import { uploadEncryptedAttachment } from "@/services/chatCrypto/encryptedAttachments.service";
import { messagesService } from "@/services/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Conversation, Message } from "@/types";

import type { OptimisticPerform } from "./optimisticSends.hook";
import styles from "./voiceNote.module.css";
import { type RecordedWebVoiceNote, useWebVoiceNoteRecorder } from "./voiceNoteRecorder.hook";
import { VoiceNoteRecordingPill } from "./voiceNoteRecordingPill";

interface VoiceNoteComposerProps {
  readonly conversation: Conversation;
  readonly viewerId: string;
  readonly sendOptimistically: (draft: Partial<Message>, perform: OptimisticPerform) => void;
  readonly onActiveChange: (isActive: boolean) => void;
}

const isHoldKey = (key: string) => key === " " || key === "Enter";

export function VoiceNoteComposer({ conversation, viewerId, sendOptimistically, onActiveChange }: VoiceNoteComposerProps) {
  const recorder = useWebVoiceNoteRecorder(sendVoiceNote);
  const { session } = recorder;
  const isActive = isVoiceNoteSessionActive(session);
  const isEngaged = session.phase !== "idle";
  const microphoneRef = useRef<HTMLButtonElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const stopButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerHold = useRef<{ readonly pointerId: number; readonly startX: number } | null>(null);
  const isKeyboardHold = useRef(false);
  const lastHoldEndedAt = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const handsFreeOfferedUntilMs = session.phase === "idle" ? session.handsFreeOfferedUntilMs : 0;

  function sendVoiceNote({ file, durationSeconds, waveform }: RecordedWebVoiceNote) {
    sendOptimistically({ kind: "voice", pendingLabel: "Encrypting…" }, async (key, report) => {
      const uploaded = await uploadEncryptedAttachment(
        file,
        { contentType: file.type || "audio/webm", fileName: null, width: null, height: null, thumbnail: null, durationSeconds, waveform },
        "voice",
        (fraction) => report(`Uploading ${Math.round(fraction * 100)}%…`),
      );
      return messagesService.sendAttachment(conversation, viewerId, { kind: "voice", mediaId: uploaded.mediaId, pointer: uploaded.pointer }, key);
    });
  }

  const startRecording = (mode?: "tap") => {
    if (!useAuthStore.getState().user) {
      requireAuthThen(() => undefined, "Sign in to send voice notes.");
      return false;
    }
    void recorder.press(mode);
    return true;
  };

  const endHold = () => {
    lastHoldEndedAt.current = Date.now();
    recorder.release();
  };

  useEffect(() => onActiveChange(isActive), [isActive, onActiveChange]);

  useEffect(() => {
    if (session.phase === "preview") playButtonRef.current?.focus();
    if (session.phase === "recording" && session.mode === "tap") stopButtonRef.current?.focus();
    if (session.phase === "idle" && document.activeElement === document.body) microphoneRef.current?.focus();
  }, [session.phase, session.mode]);

  useEffect(() => {
    if (handsFreeOfferedUntilMs <= Date.now()) return;
    const timer = window.setTimeout(() => setNow(Date.now()), handsFreeOfferedUntilMs - Date.now() + 20);
    return () => window.clearTimeout(timer);
  }, [handsFreeOfferedUntilMs]);

  useEffect(() => {
    if (!isEngaged) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      isKeyboardHold.current = false;
      recorder.cancel();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isHoldKey(event.key) || !isKeyboardHold.current) return;
      event.preventDefault();
      isKeyboardHold.current = false;
      endHold();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const hint = recorder.problem ? (
    <span className={[styles.hint, styles.problem].join(" ")} role="alert">{recorder.problem}</span>
  ) : handsFreeOfferedUntilMs > now ? (
    <span className={styles.hint} role="status">Hold to record, or tap again to record hands-free</span>
  ) : null;

  return (
    <div
      className={[styles.slot, isActive ? styles.slotActive : ""].join(" ")}
      onPointerDown={(event) => {
        if (session.phase !== "idle" || event.button !== 0 || !microphoneRef.current?.contains(event.target as Node)) return;
        if (!startRecording()) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerHold.current = { pointerId: event.pointerId, startX: event.clientX };
      }}
      onPointerMove={(event) => {
        if (pointerHold.current?.pointerId === event.pointerId) recorder.drag(pointerHold.current.startX - event.clientX);
      }}
      onPointerUp={(event) => {
        if (pointerHold.current?.pointerId !== event.pointerId) return;
        pointerHold.current = null;
        endHold();
      }}
      onPointerCancel={(event) => {
        if (pointerHold.current?.pointerId !== event.pointerId) return;
        pointerHold.current = null;
        lastHoldEndedAt.current = Date.now();
        recorder.interrupt();
      }}
    >
      {isActive ? (
        <VoiceNoteRecordingPill
          session={session}
          previewFile={recorder.previewFile}
          playButtonRef={playButtonRef}
          stopButtonRef={stopButtonRef}
          onStop={recorder.stop}
          onStopAndSend={recorder.stopAndSend}
          onDiscard={recorder.cancel}
          onSendPreview={recorder.sendPreview}
        />
      ) : (
        <>
          {hint}
          <button
            ref={microphoneRef}
            type="button"
            className={styles.micButton}
            aria-label="Hold to record a voice note"
            aria-description="Press and hold, or press Enter or Space and hold. Activate without holding to record hands-free."
            aria-busy={session.phase === "preparing"}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (!isHoldKey(event.key)) return;
              event.preventDefault();
              if (event.repeat || session.phase !== "idle") return;
              if (startRecording()) isKeyboardHold.current = true;
            }}
            onClick={() => {
              if (pointerHold.current || isKeyboardHold.current || Date.now() - lastHoldEndedAt.current < 600) return;
              startRecording("tap");
            }}
          >
            <MicrophoneIcon size={22} />
          </button>
        </>
      )}
    </div>
  );
}
