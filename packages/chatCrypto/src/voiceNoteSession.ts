export const minimumKeptVoiceNoteMilliseconds = 500;
export const maximumVoiceNoteMilliseconds = 300_000;
export const voiceNoteLevelSampleIntervalMilliseconds = 70;
export const slideToCancelDistance = 90;
export const voiceNoteDiscardSettleMilliseconds = 360;
export const handsFreeOfferMilliseconds = 4_000;

const maximumDragTrackedPixels = 240;
const maximumStoredLevels = Math.ceil(maximumVoiceNoteMilliseconds / voiceNoteLevelSampleIntervalMilliseconds) + 32;

export type VoiceNoteCaptureMode = "hold" | "tap";
export type VoiceNoteSessionPhase = "idle" | "preparing" | "recording" | "discarding" | "preview";

export interface VoiceNoteSession {
  readonly phase: VoiceNoteSessionPhase;
  readonly mode: VoiceNoteCaptureMode;
  readonly startedAtMs: number | null;
  readonly elapsedMs: number;
  readonly levels: readonly number[];
  readonly dragLeftPx: number;
  readonly discardReason: "cancelled" | "tooShort" | null;
  readonly handsFreeOfferedUntilMs: number;
}

export type VoiceNoteSessionEvent =
  | { readonly type: "pressed"; readonly atMs: number; readonly mode?: VoiceNoteCaptureMode }
  | { readonly type: "recordingStarted"; readonly atMs: number }
  | { readonly type: "preparationFailed" }
  | { readonly type: "levelSampled"; readonly level: number }
  | { readonly type: "ticked"; readonly atMs: number }
  | { readonly type: "dragged"; readonly dragLeftPx: number }
  | { readonly type: "released"; readonly atMs: number }
  | { readonly type: "interrupted"; readonly atMs: number }
  | { readonly type: "stopped"; readonly atMs: number }
  | { readonly type: "cancelled" }
  | { readonly type: "discardSettled" }
  | { readonly type: "sent" };

export const idleVoiceNoteSession: VoiceNoteSession = {
  phase: "idle", mode: "hold", startedAtMs: null, elapsedMs: 0, levels: [], dragLeftPx: 0, discardReason: null, handsFreeOfferedUntilMs: 0,
};

export const slideToCancelPull = (dragLeftPx: number) => (Number.isFinite(dragLeftPx) ? Math.min(1, Math.max(0, dragLeftPx / slideToCancelDistance)) : 0);
export const isSlideToCancelArmed = (dragLeftPx: number) => slideToCancelPull(dragLeftPx) >= 1;

export function slideToCancelAppearance(dragLeftPx: number) {
  const pull = slideToCancelPull(dragLeftPx);
  const trackedDrag = Number.isFinite(dragLeftPx) ? Math.min(maximumDragTrackedPixels, Math.max(0, dragLeftPx)) : 0;
  return {
    pull,
    isArmed: pull >= 1,
    rowTranslateX: -trackedDrag / 2,
    waveformOpacity: 1 - pull * 0.7,
    rowOpacity: 1 - pull * 0.55,
    statusOpacity: Math.max(0, 1 - pull * 1.6),
  };
}

const elapsedAt = (session: VoiceNoteSession, atMs: number) =>
  session.startedAtMs === null ? 0 : Math.min(maximumVoiceNoteMilliseconds, Math.max(0, atMs - session.startedAtMs));

function finishRecording(session: VoiceNoteSession, atMs: number, honourSlideToCancel: boolean): VoiceNoteSession {
  const elapsedMs = elapsedAt(session, atMs);
  if (honourSlideToCancel && isSlideToCancelArmed(session.dragLeftPx)) return { ...session, phase: "discarding", elapsedMs, discardReason: "cancelled" };
  if (elapsedMs < minimumKeptVoiceNoteMilliseconds) {
    return { ...session, phase: "discarding", elapsedMs, discardReason: "tooShort", handsFreeOfferedUntilMs: session.mode === "hold" ? atMs + handsFreeOfferMilliseconds : 0 };
  }
  return { ...session, phase: "preview", elapsedMs, dragLeftPx: 0 };
}

export function reduceVoiceNoteSession(session: VoiceNoteSession, event: VoiceNoteSessionEvent): VoiceNoteSession {
  switch (event.type) {
    case "pressed": {
      if (session.phase !== "idle") return session;
      const mode = event.mode ?? (event.atMs < session.handsFreeOfferedUntilMs ? "tap" : "hold");
      return { ...idleVoiceNoteSession, phase: "preparing", mode };
    }
    case "recordingStarted":
      return session.phase === "preparing" ? { ...session, phase: "recording", startedAtMs: event.atMs, elapsedMs: 0 } : session;
    case "preparationFailed":
      return session.phase === "preparing" ? { ...idleVoiceNoteSession } : session;
    case "levelSampled":
      if (session.phase !== "recording" || session.levels.length >= maximumStoredLevels) return session;
      return { ...session, levels: [...session.levels, Math.min(1, Math.max(0, Number.isFinite(event.level) ? event.level : 0))] };
    case "ticked": {
      if (session.phase !== "recording") return session;
      const elapsedMs = elapsedAt(session, event.atMs);
      return elapsedMs >= maximumVoiceNoteMilliseconds ? { ...session, phase: "preview", elapsedMs, dragLeftPx: 0 } : { ...session, elapsedMs };
    }
    case "dragged":
      return session.phase === "recording" && session.mode === "hold" ? { ...session, dragLeftPx: Math.max(0, Number.isFinite(event.dragLeftPx) ? event.dragLeftPx : 0) } : session;
    case "released":
      if (session.mode === "tap") return session;
      if (session.phase === "preparing") return { ...idleVoiceNoteSession, handsFreeOfferedUntilMs: event.atMs + handsFreeOfferMilliseconds };
      return session.phase === "recording" ? finishRecording(session, event.atMs, true) : session;
    case "interrupted":
      if (session.phase === "preparing") return { ...idleVoiceNoteSession };
      return session.phase === "recording" ? finishRecording(session, event.atMs, session.mode === "hold") : session;
    case "stopped":
      return session.phase === "recording" ? finishRecording(session, event.atMs, false) : session;
    case "cancelled":
      if (session.phase === "preparing") return { ...idleVoiceNoteSession };
      return session.phase === "recording" || session.phase === "preview" ? { ...session, phase: "discarding", discardReason: "cancelled" } : session;
    case "discardSettled":
      return session.phase === "discarding" ? { ...idleVoiceNoteSession, handsFreeOfferedUntilMs: session.handsFreeOfferedUntilMs } : session;
    case "sent":
      return session.phase === "preview" ? { ...idleVoiceNoteSession } : session;
  }
}

export const isVoiceNoteRecorderNeeded = (session: VoiceNoteSession) => session.phase === "preparing" || session.phase === "recording";
export const isVoiceNoteSessionActive = (session: VoiceNoteSession) => session.phase !== "idle" && session.phase !== "preparing";
