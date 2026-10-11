import { describe, expect, it } from "vitest";

import { evaluateSenderBehaviour } from "../../src/modules/conversations/services/senderBehaviour.service.js";
import { validateOutgoingMessage, type OutgoingMessageInput } from "../../src/modules/messages/services/messageValidation.service.js";

const now = new Date("2026-10-03T10:00:00Z");
const base: OutgoingMessageInput = { kind: "text", encryption: { deviceId: "d1", ciphertext: "Zm9v" }, media: undefined, linkPreview: undefined };

describe("validateOutgoingMessage", () => {
  it("accepts a ciphertext envelope", () => {
    expect(validateOutgoingMessage(base, now)).toMatchObject({ kind: "text", ciphertext: "Zm9v", protocol: "signal-v1", mediaExpiresAt: null });
  });
  it("refuses missing envelopes for every kind, including locations, polls and controls", () => {
    for (const kind of ["text", "location", "liveLocation", "poll", "shared", "control"] as const) {
      expect(() => validateOutgoingMessage({ ...base, kind, encryption: undefined }, now)).toThrow(/encryption envelope/);
    }
    expect(() => validateOutgoingMessage({ ...base, encryption: { deviceId: "d1", ciphertext: "x", protocol: "signal-v1-pending" } }, now)).toThrow(/protocol/);
  });
  it("rejects an old client's plaintext poll, location, document, shared item or text with a clear error", () => {
    const plaintext = {
      text: "hello", location: { latitude: 6.5, longitude: 3.3, address: "Lekki" }, poll: { question: "q", allowMultipleAnswers: false, options: ["a", "b"] },
      document: { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 }, sharedContent: { kind: "post", id: "p1" },
    };
    for (const [field, value] of Object.entries(plaintext)) {
      let error: unknown;
      try {
        validateOutgoingMessage({ ...base, kind: field === "poll" ? "poll" : "location", encryption: undefined, plaintext: { [field]: value } }, now);
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ status: 422, code: "PLAINTEXT_NOT_ACCEPTED", details: { fields: [field] } });
    }
    expect(() => validateOutgoingMessage({ ...base, plaintext: { text: "", location: null } }, now)).not.toThrow();
  });
  it("expires chat media after 30 days and needs media for documents", () => {
    const image = validateOutgoingMessage({ ...base, kind: "image", media: { mediaId: "m", durationSeconds: undefined } }, now);
    expect(image.mediaExpiresAt?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect(() => validateOutgoingMessage({ ...base, kind: "document" }, now)).toThrow(/encrypted document/);
  });
  it("keeps control messages small and media-free", () => {
    expect(validateOutgoingMessage({ ...base, kind: "control" }, now)).toMatchObject({ kind: "control", mediaExpiresAt: null });
    expect(() => validateOutgoingMessage({ ...base, kind: "control", media: { mediaId: "m", durationSeconds: undefined } }, now)).toThrow(/no media/);
    expect(() => validateOutgoingMessage({ ...base, kind: "control", linkPreview: "sealed" }, now)).toThrow(/link preview/);
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
