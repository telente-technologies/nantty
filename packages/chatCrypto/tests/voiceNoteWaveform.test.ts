import { describe, expect, it } from "vitest";

import {
  ChatCryptoClient, InMemoryKeyDirectory, MemoryKeyValueStore, downsampleLevelsByBucketMax, encodeVoiceNoteWaveform, encryptAttachment, levelFromDecibels, levelFromTimeDomainSamples,
  liveWaveformWindow, placeholderVoiceNoteWaveform, sanitizeVoiceNoteWaveform, voiceNoteBarHeight, voiceNoteDisplayLevels,
} from "../src";
import { decodePayload, encodePayload } from "../src/payload";
import { seededRandom } from "./testRandom";

const direct = "0190f0a0-0000-7000-8000-00000000d001";

describe("live microphone levels", () => {
  it("converts metering decibels to a clamped 0–1 level", () => {
    expect(levelFromDecibels(0)).toBe(1);
    expect(levelFromDecibels(6)).toBe(1);
    expect(levelFromDecibels(-55)).toBe(0);
    expect(levelFromDecibels(-160)).toBe(0);
    expect(levelFromDecibels(-27.5)).toBeCloseTo(0.5);
    expect(levelFromDecibels(Number.NaN)).toBe(0);
    expect(levelFromDecibels(undefined)).toBe(0);
    expect(levelFromDecibels(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("derives the same level scale from analyser RMS samples", () => {
    expect(levelFromTimeDomainSamples(new Float32Array(256))).toBe(0);
    expect(levelFromTimeDomainSamples([])).toBe(0);
    expect(levelFromTimeDomainSamples(new Float32Array(64).fill(1))).toBe(1);
    expect(levelFromTimeDomainSamples(new Float32Array(64).fill(10 ** (-27.5 / 20)))).toBeCloseTo(0.5);
  });

  it("shows the newest 28 samples right-aligned with empty stubs on the left", () => {
    const window = liveWaveformWindow([0.2, 0.4, 0.6]);
    expect(window).toHaveLength(28);
    expect(window.slice(0, 25).every((slot) => slot === null)).toBe(true);
    expect(window.slice(25)).toEqual([0.2, 0.4, 0.6]);
    const long = Array.from({ length: 40 }, (_, index) => index / 40);
    expect(liveWaveformWindow(long)).toEqual(long.slice(12));
    expect(liveWaveformWindow([2, -1])).toEqual([...Array(26).fill(null), 1, 0]);
  });

  it("sizes bars as 4px plus the level times 28px", () => {
    expect(voiceNoteBarHeight(null)).toBe(4);
    expect(voiceNoteBarHeight(0)).toBe(4);
    expect(voiceNoteBarHeight(0.5)).toBe(18);
    expect(voiceNoteBarHeight(1)).toBe(32);
    expect(voiceNoteBarHeight(3)).toBe(32);
  });
});

describe("downsampling recorded levels", () => {
  it("keeps the loudest sample of each bucket", () => {
    const levels = Array.from({ length: 56 }, (_, index) => (index % 2 === 0 ? 0.1 : (index + 1) / 56));
    const bars = downsampleLevelsByBucketMax(levels, 28);
    expect(bars).toHaveLength(28);
    expect(bars[0]).toBe(0.1);
    expect(bars[20]).toBeCloseTo(42 / 56);
    expect(bars[27]).toBe(1);
  });

  it("stretches short clips and fills silence with zeros", () => {
    expect(downsampleLevelsByBucketMax([0.5, 1], 4)).toEqual([0.5, 0.5, 1, 1]);
    expect(downsampleLevelsByBucketMax([], 3)).toEqual([0, 0, 0]);
    expect(downsampleLevelsByBucketMax([0.3], 0)).toEqual([]);
  });

  it("encodes 48 integer peaks between 0 and 255", () => {
    const peaks = encodeVoiceNoteWaveform(Array.from({ length: 4286 }, (_, index) => (index === 4285 ? 1 : (index % 100) / 200)));
    expect(peaks).toHaveLength(48);
    expect(peaks.every((peak) => Number.isInteger(peak) && peak >= 0 && peak <= 255)).toBe(true);
    expect(peaks[47]).toBe(255);
    expect(encodeVoiceNoteWaveform([])).toEqual(Array(48).fill(0));
  });
});

describe("waveform envelope", () => {
  it("round-trips the peaks inside the attachment pointer and the encrypted payload", async () => {
    const waveform = encodeVoiceNoteWaveform([0.1, 0.9, 0.4, 0.7]);
    const { pointer } = encryptAttachment(new Uint8Array([1, 2, 3]), { contentType: "audio/mp4", durationSeconds: 12, waveform }, seededRandom("voice"));
    expect(pointer.waveform).toEqual(waveform);
    const decoded = decodePayload(encodePayload({ text: "", attachment: pointer }, new Date("2026-10-17T10:00:00Z")));
    expect(decoded.attachment?.waveform).toEqual(waveform);

    const directory = new InMemoryKeyDirectory();
    const device = async (userId: string) => {
      const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), random: seededRandom(`wave-${userId}`) });
      await client.ensureReady(userId);
      return client;
    };
    const ada = await device("ada");
    const bola = await device("bola");
    const sent = await ada.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bola"] }, { text: "", attachment: pointer });
    expect(sent.encryption.ciphertext).not.toContain("waveform");
    expect(sent.encryption.ciphertext).not.toContain(waveform.join(","));
    const result = await bola.decryptMessage({ id: "m-1", conversationId: direct, senderId: "ada", encryption: sent.encryption });
    expect(result.status === "decrypted" ? result.payload.attachment?.waveform : result).toEqual(waveform);
  });

  it("leaves the field out for attachments without one, as old clients send", () => {
    const { pointer } = encryptAttachment(new Uint8Array([1]), { contentType: "audio/mp4" }, seededRandom("old"));
    expect("waveform" in pointer).toBe(false);
    const decoded = decodePayload(encodePayload({ text: "", attachment: pointer }, new Date()));
    expect(decoded.attachment && "waveform" in decoded.attachment).toBe(false);
  });

  it("clamps out-of-range peaks and ignores malformed waveforms", () => {
    expect(sanitizeVoiceNoteWaveform([-20, 12.4, 300, 255])).toEqual([0, 12, 255, 255]);
    expect(sanitizeVoiceNoteWaveform([1, "2", 3])).toBeNull();
    expect(sanitizeVoiceNoteWaveform([1, Number.NaN])).toBeNull();
    expect(sanitizeVoiceNoteWaveform([1, null])).toBeNull();
    expect(sanitizeVoiceNoteWaveform("1,2,3")).toBeNull();
    expect(sanitizeVoiceNoteWaveform({ 0: 1, length: 1 })).toBeNull();
    expect(sanitizeVoiceNoteWaveform([])).toBeNull();
    expect(sanitizeVoiceNoteWaveform(Array(257).fill(1))).toBeNull();
    const { pointer } = encryptAttachment(new Uint8Array([1]), { contentType: "audio/mp4" }, seededRandom("bad"));
    const decoded = decodePayload(encodePayload({ text: "", attachment: { ...pointer, waveform: ["loud"] as unknown as number[] } }, new Date()));
    expect(decoded.attachment?.key).toBe(pointer.key);
    expect(decoded.attachment && "waveform" in decoded.attachment).toBe(false);
  });

  it("draws a stable placeholder from the media id when a voice note has no waveform", () => {
    const first = placeholderVoiceNoteWaveform("media-123");
    expect(first).toHaveLength(48);
    expect(placeholderVoiceNoteWaveform("media-123")).toEqual(first);
    expect(placeholderVoiceNoteWaveform("media-456")).not.toEqual(first);
    expect(first.every((peak) => peak >= 40 && peak <= 200)).toBe(true);
    expect(voiceNoteDisplayLevels(undefined, "media-123")).toEqual(voiceNoteDisplayLevels(null, "media-123"));
    expect(voiceNoteDisplayLevels(["bad"] as unknown as number[], "media-123")).toEqual(voiceNoteDisplayLevels(null, "media-123"));
    expect(voiceNoteDisplayLevels(Array(48).fill(255), "media-123")).toEqual(Array(28).fill(1));
  });
});
