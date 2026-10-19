"use client";

import {
  type VoiceNoteCaptureMode, type VoiceNoteSession, type VoiceNoteSessionEvent, encodeVoiceNoteWaveform, idleVoiceNoteSession, levelFromTimeDomainSamples, reduceVoiceNoteSession,
  voiceNoteDiscardSettleMilliseconds, voiceNoteLevelSampleIntervalMilliseconds,
} from "@zudomart/chat-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedWebVoiceNote {
  readonly file: File;
  readonly durationSeconds: number;
  readonly waveform: readonly number[];
}

interface CaptureResources {
  readonly stream: MediaStream;
  readonly recorder: MediaRecorder;
  readonly chunks: Blob[];
  readonly audioContext: AudioContext | null;
  readonly analyser: AnalyserNode | null;
  readonly samples: Float32Array<ArrayBuffer>;
}

export const unsupportedVoiceNoteMessage = "Voice notes aren't supported in this browser. Attach an audio file instead.";
export const deniedMicrophoneMessage = "Allow microphone access to record a voice note.";

const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function startLevelAnalysis(stream: MediaStream) {
  try {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    return { audioContext, analyser, samples: new Float32Array(analyser.fftSize) };
  } catch {
    return { audioContext: null, analyser: null, samples: new Float32Array(0) };
  }
}

function releaseCapture(resources: CaptureResources) {
  resources.stream.getTracks().forEach((track) => track.stop());
  resources.audioContext?.close().catch(() => undefined);
}

function stopCapture(resources: CaptureResources, keepFile: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const finish = () => {
      releaseCapture(resources);
      if (!keepFile) return resolve(null);
      const type = resources.recorder.mimeType || "audio/webm";
      resolve(new File([new Blob(resources.chunks, { type })], "voice-note", { type }));
    };
    if (resources.recorder.state === "inactive") return finish();
    resources.recorder.addEventListener("stop", finish, { once: true });
    try {
      resources.recorder.stop();
    } catch {
      finish();
    }
  });
}

export function useWebVoiceNoteRecorder(onRecordingFinished: (voiceNote: RecordedWebVoiceNote) => void) {
  const [session, setSession] = useState<VoiceNoteSession>(idleVoiceNoteSession);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const sessionRef = useRef(session);
  const captureRef = useRef<CaptureResources | null>(null);
  const shouldSendWhenStoppedRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const onRecordingFinishedRef = useRef(onRecordingFinished);
  useEffect(() => {
    onRecordingFinishedRef.current = onRecordingFinished;
  }, [onRecordingFinished]);

  const commit = useCallback((next: VoiceNoteSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const sendPreview = useCallback((file: File) => {
    const current = sessionRef.current;
    shouldSendWhenStoppedRef.current = false;
    setPreviewFile(null);
    onRecordingFinishedRef.current({ file, durationSeconds: Math.max(1, Math.round(current.elapsedMs / 1000)), waveform: encodeVoiceNoteWaveform(current.levels) });
    commit(reduceVoiceNoteSession(current, { type: "sent" }));
  }, [commit]);

  const dispatch = useCallback((event: VoiceNoteSessionEvent) => {
    const previous = sessionRef.current;
    const next = reduceVoiceNoteSession(previous, event);
    if (next === previous) return previous;
    commit(next);
    if (previous.phase === "recording" && next.phase !== "recording" && captureRef.current) {
      const resources = captureRef.current;
      captureRef.current = null;
      void stopCapture(resources, next.phase === "preview").then((file) => {
        if (sessionRef.current.phase !== "preview") return;
        if (!file) return commit(reduceVoiceNoteSession(sessionRef.current, { type: "cancelled" }));
        if (shouldSendWhenStoppedRef.current) sendPreview(file);
        else setPreviewFile(file);
      });
    }
    if (next.phase === "discarding" && previous.phase !== "discarding") {
      setPreviewFile(null);
      shouldSendWhenStoppedRef.current = false;
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => commit(reduceVoiceNoteSession(sessionRef.current, { type: "discardSettled" })), prefersReducedMotion() ? 0 : voiceNoteDiscardSettleMilliseconds);
    }
    return previous;
  }, [commit, sendPreview]);

  const press = useCallback(async (mode?: VoiceNoteCaptureMode) => {
    if (dispatch({ type: "pressed", atMs: Date.now(), mode }).phase !== "idle") return;
    setProblem(null);
    const failWith = (message: string) => {
      dispatch({ type: "preparationFailed" });
      setProblem(message);
    };
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return failWith(unsupportedVoiceNoteMessage);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return failWith(deniedMicrophoneMessage);
    }
    if (sessionRef.current.phase !== "preparing") {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    try {
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));
      recorder.start();
      captureRef.current = { stream, recorder, chunks, ...startLevelAnalysis(stream) };
      dispatch({ type: "recordingStarted", atMs: Date.now() });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      failWith("Couldn't start recording. Please try again.");
    }
  }, [dispatch]);

  const isRecording = session.phase === "recording";
  useEffect(() => {
    if (!isRecording) return;
    const sampler = window.setInterval(() => {
      const capture = captureRef.current;
      if (capture?.analyser) capture.analyser.getFloatTimeDomainData(capture.samples);
      dispatch({ type: "levelSampled", level: capture?.analyser ? levelFromTimeDomainSamples(capture.samples) : 0 });
      dispatch({ type: "ticked", atMs: Date.now() });
    }, voiceNoteLevelSampleIntervalMilliseconds);
    const interrupt = () => dispatch({ type: "interrupted", atMs: Date.now() });
    const interruptWhenHidden = () => document.visibilityState === "hidden" && interrupt();
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", interruptWhenHidden);
    return () => {
      window.clearInterval(sampler);
      window.removeEventListener("blur", interrupt);
      document.removeEventListener("visibilitychange", interruptWhenHidden);
    };
  }, [dispatch, isRecording]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (captureRef.current) void stopCapture(captureRef.current, false);
    captureRef.current = null;
  }, []);

  return {
    session,
    previewFile,
    problem,
    dismissProblem: () => setProblem(null),
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
      if (sessionRef.current.phase === "preview" && previewFile) sendPreview(previewFile);
    },
  };
}
