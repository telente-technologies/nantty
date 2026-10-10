import { describe, expect, it } from "vitest";

import type { ChatMediaAccess } from "../../src/interfaces/chatMediaAccess.interface.js";
import { verifyChatMediaOwnership } from "../../src/modules/messages/services/chatMediaOwnership.service.js";

const senderId = "0192f0a0-0000-7000-8000-00000000a001";
const mediaId = "0192f0a0-0000-7000-8000-000000000001";
const accessFor = (purpose: string): ChatMediaAccess => ({
  describe: async () => ({ id: mediaId, ownerId: senderId, purpose, kind: "encrypted", status: "uploaded", sizeBytes: 2048 }),
  signForParticipant: async () => null,
});

describe("encrypted chat media", () => {
  it("accepts opaque encrypted blobs uploaded for chat or voice", async () => {
    await expect(verifyChatMediaOwnership(accessFor("chat"), senderId, "image", mediaId)).resolves.toMatchObject({ mediaId, ready: false });
    await expect(verifyChatMediaOwnership(accessFor("chat"), senderId, "document", mediaId)).resolves.toMatchObject({ mediaId });
    await expect(verifyChatMediaOwnership(accessFor("voice"), senderId, "voice", mediaId)).resolves.toMatchObject({ mediaId });
  });

  it("still enforces the purpose for encrypted blobs", async () => {
    await expect(verifyChatMediaOwnership(accessFor("chat"), senderId, "voice", mediaId)).rejects.toMatchObject({ code: "MEDIA_TYPE_MISMATCH" });
    await expect(verifyChatMediaOwnership(accessFor("post"), senderId, "image", mediaId)).rejects.toMatchObject({ code: "MEDIA_TYPE_MISMATCH" });
  });
});
