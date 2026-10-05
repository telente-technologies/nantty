import { createHash, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { encryptedChatMimeType } from "../../src/constants/purposePolicy.constant.js";
import { runMediaPipeline } from "../../src/modules/assets/services/mediaPipeline.service.js";
import { requireUploadAllowed } from "../../src/utils/purposePolicy.util.js";
import { createHarness, firstAttempt } from "../fakes/pipelineHarness.js";

describe("encrypted chat blobs", () => {
  it("stores the ciphertext privately as-is, with no processing and a 30-day expiry", async () => {
    const harness = createHarness();
    const bytes = randomBytes(4096);
    const id = harness.seedUpload({ purpose: "chat", mimeType: encryptedChatMimeType, bytes, isPrivate: true, kind: "encrypted", sha256: createHash("sha256").update(bytes).digest("hex") });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", kind: "encrypted" });
    expect((harness.db.assets.get(id)?.["expiresAt"] as Date).toISOString()).toBe("2026-11-02T12:00:00.000Z");
    expect(harness.db.variants.filter((variant) => variant["assetId"] === id).map((variant) => variant["format"])).toEqual(["bin"]);
    expect(harness.storage.keysIn(harness.context.config.storage.publicBucket)).toHaveLength(0);
  });

  it("keeps size limits and checksum checks, and only allows chat and voice purposes", async () => {
    const harness = createHarness();
    const bytes = randomBytes(1024);
    const mismatched = harness.seedUpload({ purpose: "voice", mimeType: encryptedChatMimeType, bytes, isPrivate: true, kind: "encrypted", sha256: "0".repeat(64) });
    await runMediaPipeline(harness.context, mismatched, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(mismatched)?.["rejectionReason"]).toBe("CHECKSUM_MISMATCH");
    expect(() => requireUploadAllowed("voice", encryptedChatMimeType, 11 * 1024 * 1024)).toThrow();
    expect(() => requireUploadAllowed("post", encryptedChatMimeType, 1024)).toThrow();
    expect(requireUploadAllowed("chat", encryptedChatMimeType, 90 * 1024 * 1024).kind).toBe("encrypted");
  });
});
