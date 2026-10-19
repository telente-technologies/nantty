import { describe, expect, it } from "vitest";

import {
  type VoiceNoteSession, type VoiceNoteSessionEvent, idleVoiceNoteSession, isSlideToCancelArmed, isVoiceNoteRecorderNeeded, maximumVoiceNoteMilliseconds, reduceVoiceNoteSession,
  slideToCancelAppearance, slideToCancelPull,
} from "../src";

const run = (events: readonly VoiceNoteSessionEvent[], from: VoiceNoteSession = idleVoiceNoteSession) => events.reduce(reduceVoiceNoteSession, from);
const recordingSince = (atMs: number, mode?: "hold" | "tap") => run([{ type: "pressed", atMs, mode }, { type: "recordingStarted", atMs }]);

describe("slide to cancel", () => {
  it("pulls in over 90px and arms at the end", () => {
    expect(slideToCancelPull(0)).toBe(0);
    expect(slideToCancelPull(45)).toBe(0.5);
    expect(slideToCancelPull(90)).toBe(1);
    expect(slideToCancelPull(400)).toBe(1);
    expect(slideToCancelPull(-30)).toBe(0);
    expect(slideToCancelPull(Number.NaN)).toBe(0);
    expect(isSlideToCancelArmed(89.9)).toBe(false);
    expect(isSlideToCancelArmed(90)).toBe(true);
  });

  it("fades the row, waveform and status at their own rates and follows at half the drag", () => {
    expect(slideToCancelAppearance(0)).toEqual({ pull: 0, isArmed: false, rowTranslateX: -0, waveformOpacity: 1, rowOpacity: 1, statusOpacity: 1 });
    const half = slideToCancelAppearance(45);
    expect(half.rowTranslateX).toBe(-22.5);
    expect(half.waveformOpacity).toBeCloseTo(0.65);
    expect(half.rowOpacity).toBeCloseTo(0.725);
    expect(half.statusOpacity).toBeCloseTo(0.2);
    const armed = slideToCancelAppearance(90);
    expect(armed).toMatchObject({ isArmed: true, rowTranslateX: -45, statusOpacity: 0 });
    expect(armed.waveformOpacity).toBeCloseTo(0.3);
    expect(armed.rowOpacity).toBeCloseTo(0.45);
  });
});

describe("hold to record", () => {
  it("keeps a clip released after half a second and opens the preview", () => {
    const session = run([{ type: "levelSampled", level: 0.4 }, { type: "released", atMs: 1_800 }], recordingSince(1_000));
    expect(session).toMatchObject({ phase: "preview", elapsedMs: 800, levels: [0.4] });
  });

  it("discards a clip shorter than 0.5s and offers hands-free recording", () => {
    const session = run([{ type: "released", atMs: 1_499 }], recordingSince(1_000));
    expect(session).toMatchObject({ phase: "discarding", discardReason: "tooShort", handsFreeOfferedUntilMs: 5_499 });
    const next = run([{ type: "discardSettled" }, { type: "pressed", atMs: 2_000 }], session);
    expect(next).toMatchObject({ phase: "preparing", mode: "tap" });
    expect(run([{ type: "discardSettled" }, { type: "pressed", atMs: 9_000 }], session).mode).toBe("hold");
  });

  it("discards when released while armed, and keeps it when dragged back", () => {
    const armed = run([{ type: "dragged", dragLeftPx: 120 }, { type: "released", atMs: 5_000 }], recordingSince(0));
    expect(armed).toMatchObject({ phase: "discarding", discardReason: "cancelled" });
    const draggedBack = run([{ type: "dragged", dragLeftPx: 120 }, { type: "dragged", dragLeftPx: 30 }, { type: "released", atMs: 5_000 }], recordingSince(0));
    expect(draggedBack.phase).toBe("preview");
  });

  it("discards on Escape and settles back to idle", () => {
    const session = run([{ type: "cancelled" }], recordingSince(0));
    expect(session.phase).toBe("discarding");
    expect(run([{ type: "discardSettled" }], session)).toEqual(idleVoiceNoteSession);
  });

  it("keeps the clip on pointer cancel, blur or backgrounding, unless armed", () => {
    expect(run([{ type: "interrupted", atMs: 3_000 }], recordingSince(0)).phase).toBe("preview");
    expect(run([{ type: "dragged", dragLeftPx: 95 }, { type: "interrupted", atMs: 3_000 }], recordingSince(0)).phase).toBe("discarding");
    expect(run([{ type: "interrupted", atMs: 3_000 }], recordingSince(0, "tap")).phase).toBe("preview");
  });

  it("auto-stops at the 300s maximum", () => {
    const almost = run([{ type: "ticked", atMs: maximumVoiceNoteMilliseconds - 1 }], recordingSince(0));
    expect(almost.phase).toBe("recording");
    const stopped = run([{ type: "ticked", atMs: maximumVoiceNoteMilliseconds + 400 }], recordingSince(0));
    expect(stopped).toMatchObject({ phase: "preview", elapsedMs: maximumVoiceNoteMilliseconds });
    expect(run([{ type: "released", atMs: maximumVoiceNoteMilliseconds + 900 }], recordingSince(0)).elapsedMs).toBe(maximumVoiceNoteMilliseconds);
  });
});

describe("off the happy path", () => {
  it("ignores a second press while preparing, recording or previewing", () => {
    const preparing = run([{ type: "pressed", atMs: 0 }]);
    expect(run([{ type: "pressed", atMs: 10 }], preparing)).toBe(preparing);
    const recording = recordingSince(0);
    expect(run([{ type: "pressed", atMs: 10 }], recording)).toBe(recording);
    const preview = run([{ type: "released", atMs: 2_000 }], recording);
    expect(run([{ type: "pressed", atMs: 2_100 }], preview)).toBe(preview);
  });

  it("drops the recording when released before the microphone actually started", () => {
    const released = run([{ type: "pressed", atMs: 0 }, { type: "released", atMs: 200 }]);
    expect(released.phase).toBe("idle");
    expect(isVoiceNoteRecorderNeeded(released)).toBe(false);
    const lateStart = run([{ type: "recordingStarted", atMs: 600 }], released);
    expect(lateStart.phase).toBe("idle");
    expect(isVoiceNoteRecorderNeeded(lateStart)).toBe(false);
  });

  it("returns to idle when permission is denied or preparation fails", () => {
    expect(run([{ type: "pressed", atMs: 0 }, { type: "preparationFailed" }])).toEqual(idleVoiceNoteSession);
  });

  it("cancels during preparation without ever recording", () => {
    const cancelled = run([{ type: "pressed", atMs: 0 }, { type: "cancelled" }, { type: "recordingStarted", atMs: 100 }]);
    expect(cancelled.phase).toBe("idle");
  });

  it("ignores samples, drags and ticks outside recording", () => {
    expect(run([{ type: "levelSampled", level: 1 }, { type: "dragged", dragLeftPx: 99 }, { type: "ticked", atMs: 9 }])).toEqual(idleVoiceNoteSession);
    expect(run([{ type: "levelSampled", level: Number.NaN }, { type: "levelSampled", level: 4 }], recordingSince(0)).levels).toEqual([0, 1]);
  });
});

describe("tap to record", () => {
  it("keeps recording after the finger lifts and stops from the stop button", () => {
    const recording = run([{ type: "released", atMs: 100 }, { type: "dragged", dragLeftPx: 200 }], recordingSince(0, "tap"));
    expect(recording).toMatchObject({ phase: "recording", dragLeftPx: 0 });
    expect(run([{ type: "stopped", atMs: 4_000 }], recording)).toMatchObject({ phase: "preview", elapsedMs: 4_000 });
  });

  it("sends from the preview and returns to idle", () => {
    const preview = run([{ type: "stopped", atMs: 4_000 }], recordingSince(0, "tap"));
    expect(run([{ type: "sent" }], preview)).toEqual(idleVoiceNoteSession);
    expect(run([{ type: "cancelled" }], preview).phase).toBe("discarding");
  });
});
