import { describe, expect, it } from "vitest";

import { evaluateSenderBehaviour } from "../../src/modules/conversations/services/senderBehaviour.service.js";
import { validateOutgoingMessage, type OutgoingMessageInput } from "../../src/modules/messages/services/messageValidation.service.js";

const now = new Date("2026-10-03T10:00:00Z");
const base: OutgoingMessageInput = { kind: "text", text: undefined, encryption: { deviceId: "d1", ciphertext: "Zm9v" }, media: undefined, linkPreview: undefined, sharedContent: undefined, location: undefined, document: undefined, poll: undefined };

describe("validateOutgoingMessage", () => {
  it("accepts a ciphertext envelope", () => {
    expect(validateOutgoingMessage(base, now)).toMatchObject({ kind: "text", ciphertext: "Zm9v", protocol: "signal-v1-pending", mediaExpiresAt: null });
  });
  it("refuses plaintext and missing envelopes", () => {
    expect(() => validateOutgoingMessage({ ...base, text: "hello" }, now)).toThrow(/end-to-end/);
    expect(() => validateOutgoingMessage({ ...base, encryption: undefined }, now)).toThrow(/envelope/);
  });
  it("expires chat media after 30 days", () => {
    const image = validateOutgoingMessage({ ...base, kind: "image", media: { mediaId: "m", url: null, durationSeconds: undefined } }, now);
    expect(image.mediaExpiresAt?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  });
  it("limits live location to 8 hours", () => {
    const location = { latitude: 6.5, longitude: 3.3, address: null };
    expect(() => validateOutgoingMessage({ ...base, kind: "liveLocation", location: { ...location, liveUntil: "2026-10-03T19:00:00Z" } }, now)).toThrow(/8 hours/);
    expect(validateOutgoingMessage({ ...base, kind: "liveLocation", location: { ...location, liveUntil: "2026-10-03T11:00:00Z" } }, now).location?.liveUntil).toBe("2026-10-03T11:00:00.000Z");
  });
  it("validates polls and documents", () => {
    expect(() => validateOutgoingMessage({ ...base, kind: "poll", poll: { question: "q", allowMultipleAnswers: false, options: ["a", "A"] } }, now)).toThrow(/different/);
    expect(() => validateOutgoingMessage({ ...base, kind: "poll", poll: { question: "q", allowMultipleAnswers: false, options: ["a"] } }, now)).toThrow(/2 to 6/);
    expect(() => validateOutgoingMessage({ ...base, kind: "document", document: { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 200 * 1024 * 1024 } }, now)).toThrow(/100 MB/);
  });
});

describe("evaluateSenderBehaviour", () => {
  it("flags bursts, new accounts and external scores", () => {
    expect(evaluateSenderBehaviour({ recipientsInWindow: 50, accountAgeDays: 90, externalScore: null }).spam).toBe(true);
    expect(evaluateSenderBehaviour({ recipientsInWindow: 20, accountAgeDays: 1, externalScore: null }).spam).toBe(true);
    expect(evaluateSenderBehaviour({ recipientsInWindow: 20, accountAgeDays: 30, externalScore: null }).spam).toBe(false);
    expect(evaluateSenderBehaviour({ recipientsInWindow: 1, accountAgeDays: 30, externalScore: 0.95 }).spam).toBe(true);
  });
});
