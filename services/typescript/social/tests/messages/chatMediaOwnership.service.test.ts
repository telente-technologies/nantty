import { describe, expect, it, vi } from "vitest";

import type { ChatMediaAccess, ChatMediaDescriptor } from "../../src/interfaces/chatMediaAccess.interface.js";
import { signChatMediaUrls, verifyChatMediaOwnership } from "../../src/modules/messages/services/chatMediaOwnership.service.js";
import { sendMessageBodySchema } from "../../src/modules/messages/validators/messages.validator.js";
import { validateOutgoingMessage, type OutgoingMessageInput } from "../../src/modules/messages/services/messageValidation.service.js";

const senderId = "0192f0a0-0000-7000-8000-00000000a001";
const otherId = "0192f0a0-0000-7000-8000-00000000b001";
const mediaId = "0192f0a0-0000-7000-8000-0000000000m1".replace("m", "0");

function accessFor(descriptor: Partial<ChatMediaDescriptor> | undefined, signedUrl: string | null = "https://cdn/private?sig=1"): ChatMediaAccess & { signForParticipant: ReturnType<typeof vi.fn> } {
  return {
    describe: async () => (descriptor === undefined ? undefined : { id: mediaId, ownerId: senderId, purpose: "voice", kind: "audio", status: "ready", sizeBytes: 1000, ...descriptor }),
    signForParticipant: vi.fn(async () => signedUrl),
  };
}

describe("chat media ownership", () => {
  it("accepts the sender's own voice upload and prefers the server duration", async () => {
    const verified = await verifyChatMediaOwnership(accessFor({ durationSeconds: 12 }), senderId, "voice", mediaId);
    expect(verified).toEqual({ mediaId, ready: true, sizeBytes: 1000, durationSeconds: 12 });
  });

  it("rejects media uploaded by someone else", async () => {
    await expect(verifyChatMediaOwnership(accessFor({ ownerId: otherId }), senderId, "voice", mediaId)).rejects.toMatchObject({ status: 403, code: "MEDIA_NOT_OWNED" });
  });

  it("rejects unknown media", async () => {
    await expect(verifyChatMediaOwnership(accessFor(undefined), senderId, "image", mediaId)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects the wrong purpose or kind (voice must be a voice upload, images must be chat images)", async () => {
    await expect(verifyChatMediaOwnership(accessFor({ purpose: "chat", kind: "image" }), senderId, "voice", mediaId)).rejects.toMatchObject({ code: "MEDIA_TYPE_MISMATCH" });
    await expect(verifyChatMediaOwnership(accessFor({ purpose: "post", kind: "image" }), senderId, "image", mediaId)).rejects.toMatchObject({ code: "MEDIA_TYPE_MISMATCH" });
    await expect(verifyChatMediaOwnership(accessFor({ purpose: "kyc", kind: "document" }), senderId, "document", mediaId)).rejects.toMatchObject({ code: "MEDIA_TYPE_MISMATCH" });
  });

  it("rejects failed or deleted uploads and fails closed without a media service", async () => {
    await expect(verifyChatMediaOwnership(accessFor({ status: "deleted" }), senderId, "voice", mediaId)).rejects.toMatchObject({ code: "MEDIA_NOT_USABLE" });
    await expect(verifyChatMediaOwnership(undefined, senderId, "voice", mediaId)).rejects.toMatchObject({ status: 503 });
  });

  it("signs URLs per viewer and drops media it cannot sign", async () => {
    const access = accessFor({});
    const urls = await signChatMediaUrls(access, otherId, [mediaId, mediaId]);
    expect(urls.get(mediaId)).toBe("https://cdn/private?sig=1");
    expect(access.signForParticipant).toHaveBeenCalledTimes(1);
    expect(access.signForParticipant).toHaveBeenCalledWith(mediaId, otherId);
    expect((await signChatMediaUrls(accessFor({}, null), otherId, [mediaId])).size).toBe(0);
    expect((await signChatMediaUrls(undefined, otherId, [mediaId])).size).toBe(0);
  });

  it("ignores client-supplied media URLs", () => {
    const parsed = sendMessageBodySchema.parse({ kind: "voice", mediaId, mediaUrl: "https://evil.example/a.mp3" }) as Record<string, unknown>;
    expect(parsed["mediaUrl"]).toBeUndefined();
  });

  it("requires an uploaded media id for documents", () => {
    const base: OutgoingMessageInput = { kind: "document", encryption: { deviceId: "d1", ciphertext: "sealed" }, media: undefined, linkPreview: undefined };
    expect(() => validateOutgoingMessage(base, new Date())).toThrow(/Upload the encrypted document/);
    expect(validateOutgoingMessage({ ...base, media: { mediaId, durationSeconds: undefined } }, new Date()).mediaExpiresAt).not.toBeNull();
  });
});
