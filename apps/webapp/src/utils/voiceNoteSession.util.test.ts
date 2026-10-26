import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type VoiceNoteSessionEvent, encodeVoiceNoteWaveform, encryptAttachment, idleVoiceNoteSession, reduceVoiceNoteSession, sanitizeAttachmentPointer, voiceNoteDisplayLevels } from "@nantty/chat-crypto";

import { deniedMicrophoneMessage, unsupportedVoiceNoteMessage } from "../components/messages/voiceNoteRecorder.hook";

const run = (events: readonly VoiceNoteSessionEvent[]) => events.reduce(reduceVoiceNoteSession, idleVoiceNoteSession);

describe("web voice note sessions", () => {
  it("keeps the clip when the tab loses focus mid-recording", () => {
    const session = run([{ type: "pressed", atMs: 0 }, { type: "recordingStarted", atMs: 0 }, { type: "levelSampled", level: 0.6 }, { type: "interrupted", atMs: 3_000 }]);
    assert.equal(session.phase, "preview");
    assert.equal(session.elapsedMs, 3_000);
  });

  it("treats a keyboard hold like a pointer hold and Escape as discard", () => {
    const held = run([{ type: "pressed", atMs: 0 }, { type: "recordingStarted", atMs: 10 }, { type: "released", atMs: 1_200 }]);
    assert.equal(held.phase, "preview");
    const escaped = run([{ type: "pressed", atMs: 0 }, { type: "recordingStarted", atMs: 10 }, { type: "cancelled" }]);
    assert.equal(escaped.phase, "discarding");
  });

  it("returns to idle when the microphone is denied or unsupported", () => {
    assert.equal(run([{ type: "pressed", atMs: 0 }, { type: "preparationFailed" }]).phase, "idle");
    assert.match(unsupportedVoiceNoteMessage, /aren't supported in this browser/);
    assert.match(deniedMicrophoneMessage, /Allow microphone access/);
  });

  it("starts hands-free from an assistive-technology click and ignores the lifted finger", () => {
    const session = run([{ type: "pressed", atMs: 0, mode: "tap" }, { type: "recordingStarted", atMs: 5 }, { type: "released", atMs: 50 }]);
    assert.equal(session.phase, "recording");
    assert.equal(run([{ type: "pressed", atMs: 0, mode: "tap" }, { type: "recordingStarted", atMs: 5 }, { type: "stopped", atMs: 2_000 }]).phase, "preview");
  });
});

describe("web voice note envelope", () => {
  it("puts the waveform inside the encrypted pointer, matching what mobile sends", () => {
    const waveform = encodeVoiceNoteWaveform([0.1, 0.8, 0.3]);
    const { pointer } = encryptAttachment(new Uint8Array([9, 9]), { contentType: "audio/webm", durationSeconds: 3, waveform });
    assert.deepEqual(sanitizeAttachmentPointer(JSON.parse(JSON.stringify(pointer)))?.waveform, waveform);
    assert.equal(waveform.length, 48);
  });

  it("falls back to a placeholder for voice notes from older clients", () => {
    assert.deepEqual(voiceNoteDisplayLevels(undefined, "media-1"), voiceNoteDisplayLevels(null, "media-1"));
    assert.equal(voiceNoteDisplayLevels(undefined, "media-1").length, 28);
  });
});
