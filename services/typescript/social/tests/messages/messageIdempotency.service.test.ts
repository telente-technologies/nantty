import { describe, expect, it } from "vitest";

import { SocialError } from "../../src/errors/social.error.js";
import type { MessageRow } from "../../src/modules/messages/repositories/message.repository.js";
import type { OutgoingMessageInput } from "../../src/modules/messages/services/messageValidation.service.js";
import { assertMessageReplayMatches, createMessagePayloadHash } from "../../src/modules/messages/services/messageIdempotency.service.js";

const message: OutgoingMessageInput = {
  kind: "text",
  encryption: { deviceId: "device-a", ciphertext: "opaque-ciphertext", protocol: "signal-v1" },
  media: undefined,
  linkPreview: null,
};

const row = (clientPayloadHash: string | null): MessageRow => ({
  id: "message-id", conversationId: "conversation-id", senderId: "sender-id", senderLabel: null, kind: "text", clientMessageId: "client-id",
  clientPayloadHash, ciphertext: "opaque-ciphertext", deviceId: "device-a", protocol: "signal-v1", mediaId: null, mediaType: null, mediaUrl: null,
  mediaStatus: null, mediaDurationSeconds: null, linkPreviewEnvelope: null, mentions: [], expiresAt: null, mediaExpiresAt: null, mediaPurgedAt: null,
  hiddenAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("message client idempotency", () => {
  it("hashes normalized protocol defaults and canonical object-key order", () => {
    const omittedProtocol: OutgoingMessageInput = { ...message, encryption: { deviceId: "device-a", ciphertext: "opaque-ciphertext" } };
    expect(createMessagePayloadHash(omittedProtocol, undefined)).toBe(createMessagePayloadHash(message, []));
  });

  it("accepts an exact retry and rejects a different encrypted payload", () => {
    assertMessageReplayMatches(row(createMessagePayloadHash(message, [])), createMessagePayloadHash(message, []), message, []);
    const changed = { ...message, encryption: { ...message.encryption!, ciphertext: "different-ciphertext" } };
    expect(() => assertMessageReplayMatches(row(createMessagePayloadHash(message, [])), createMessagePayloadHash(changed, []), changed, []))
      .toThrowError(expect.objectContaining({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 }));
  });

  it("accepts exact legacy retries and rejects a changed encrypted payload", () => {
    assertMessageReplayMatches(row(null), createMessagePayloadHash(message, []), message, []);
    const changed = { ...message, encryption: { ...message.encryption!, ciphertext: "different-ciphertext" } };
    try {
      assertMessageReplayMatches(row(null), createMessagePayloadHash(changed, []), changed, []);
      throw new Error("expected replay conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(SocialError);
      expect(error).toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 });
    }
  });
});
