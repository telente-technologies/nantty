import {
  type VoiceNoteCaptureMode, type VoiceNoteSession, type VoiceNoteSessionEvent, encodeVoiceNoteWaveform, formatVoiceNoteClock, idleVoiceNoteSession, isSlideToCancelArmed, levelFromDecibels,
  maximumVoiceNoteMilliseconds, reduceVoiceNoteSession, voiceNoteDiscardSettleMilliseconds, voiceNoteLevelSampleIntervalMilliseconds,
} from "@zudomart/chat-crypto";
import { type RecordingOptions, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

const voiceNoteRecordingOptions: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export interface RecordedVoiceNote {
  readonly file: LocalMediaFile;
  readonly waveform: readonly number[];
}

export const formatVoiceNoteDuration = formatVoiceNoteClock;

const releaseRecordingAudioMode = () => setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

export function useVoiceNoteRecorder(onRecordingFinished: (voiceNote: RecordedVoiceNote) => void, reduceMotion: boolean) {
  const recorder = useAudioRecorder(voiceNoteRecordingOptions);
  const [session, setSession] = useState<VoiceNoteSession>(idleVoiceNoteSession);
  const [previewFile, setPreviewFile] = useState<LocalMediaFile | null>(null);
  const sessionRef = useRef(session);
  const shouldSendWhenStoppedRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRecordingFinishedRef = useRef(onRecordingFinished);
  useEffect(() => {
    onRecordingFinishedRef.current = onRecordingFinished;
  }, [onRecordingFinished]);

  const sendPreview = useCallback((file: LocalMediaFile, current: VoiceNoteSession) => {
    onRecordingFinishedRef.current({ file, waveform: encodeVoiceNoteWaveform(current.levels) });
    shouldSendWhenStoppedRef.current = false;
    setPreviewFile(null);
    sessionRef.current = reduceVoiceNoteSession(sessionRef.current, { type: "sent" });
    setSession(sessionRef.current);
  }, []);

  const stopRecorder = useCallback(async (keepFile: boolean) => {
    try {
      if (recorder.getStatus().isRecording) await recorder.stop();
    } catch {
      return null;
    } finally {
      await releaseRecordingAudioMode();
    }
    if (!keepFile || !recorder.uri) return null;
    const isWebRecording = Platform.OS === "web";
    return {
      uri: recorder.uri,
      mediaType: "audio",
      mimeType: isWebRecording ? "audio/webm" : "audio/mp4",
      fileName: `voice-note-${Date.now()}.${isWebRecording ? "webm" : "m4a"}`,
      sizeBytes: null,
      width: null,
      height: null,
      durationSeconds: sessionRef.current.elapsedMs / 1000,
    } satisfies LocalMediaFile;
  }, [recorder]);

  const dispatch = useCallback((event: VoiceNoteSessionEvent) => {
    const previous = sessionRef.current;
    const next = reduceVoiceNoteSession(previous, event);
    if (next === previous) return previous;
    sessionRef.current = next;
    setSession(next);
    if (!isSlideToCancelArmed(previous.dragLeftPx) && isSlideToCancelArmed(next.dragLeftPx)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (previous.phase === "recording" && next.phase !== "recording") {
      void stopRecorder(next.phase === "preview").then((file) => {
        if (sessionRef.current.phase !== "preview") return;
        if (!file) {
          sessionRef.current = reduceVoiceNoteSession(sessionRef.current, { type: "cancelled" });
          setSession(sessionRef.current);
          return;
        }
        if (shouldSendWhenStoppedRef.current) sendPreview(file, sessionRef.current);
        else setPreviewFile(file);
      });
    }
    if (next.phase === "discarding" && previous.phase !== "discarding") {
      setPreviewFile(null);
      shouldSendWhenStoppedRef.current = false;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        sessionRef.current = reduceVoiceNoteSession(sessionRef.current, { type: "discardSettled" });
        setSession(sessionRef.current);
      }, reduceMotion ? 0 : voiceNoteDiscardSettleMilliseconds);
    }
    return previous;
  }, [reduceMotion, sendPreview, stopRecorder]);

  const press = useCallback(async (mode?: VoiceNoteCaptureMode) => {
    if (dispatch({ type: "pressed", atMs: Date.now(), mode }).phase !== "idle") return;
    const isStillPreparing = () => sessionRef.current.phase === "preparing";
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        dispatch({ type: "preparationFailed" });
        showAlertWithButtons("Microphone needed", "Allow microphone access in Settings to send voice notes.", undefined, { intent: "microphone" });
        return;
      }
      if (!isStillPreparing()) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!isStillPreparing()) {
        await releaseRecordingAudioMode();
        return;
      }
      recorder.record({ forDuration: maximumVoiceNoteMilliseconds / 1000 });
      dispatch({ type: "recordingStarted", atMs: Date.now() });
    } catch {
      dispatch({ type: "preparationFailed" });
      await releaseRecordingAudioMode();
      showAlertWithButtons("Couldn't start recording", "Please try again.", undefined, { intent: "microphone" });
    }
  }, [dispatch, recorder]);

  const isRecording = session.phase === "recording";
  useEffect(() => {
    if (!isRecording) return;
    const sampler = setInterval(() => {
      const status = recorder.getStatus();
      dispatch({ type: "levelSampled", level: levelFromDecibels(status.metering) });
      dispatch({ type: status.isRecording ? "ticked" : "interrupted", atMs: Date.now() });
    }, voiceNoteLevelSampleIntervalMilliseconds);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "background") dispatch({ type: "interrupted", atMs: Date.now() });
    });
    return () => {
      clearInterval(sampler);
      appStateSubscription.remove();
    };
  }, [dispatch, isRecording, recorder]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (sessionRef.current.phase === "recording") void stopRecorder(false);
  }, [stopRecorder]);

  return {
    session,
    previewFile,
    press,
    drag: (dragLeftPx: number) => dispatch({ type: "dragged", dragLeftPx }),
    release: () => dispatch({ type: "released", atMs: Date.now() }),
    interrupt: () => dispatch({ type: "interrupted", atMs: Date.now() }),
    stop: () => dispatch({ type: "stopped", atMs: Date.now() }),
    cancel: () => dispatch({ type: "cancelled" }),
    stopAndSend: () => {
      shouldSendWhenStoppedRef.current = true;
      dispatch({ type: "stopped", atMs: Date.now() });
    },
    sendPreview: () => {
      if (sessionRef.current.phase === "preview" && previewFile) sendPreview(previewFile, sessionRef.current);
    },
  };
}
