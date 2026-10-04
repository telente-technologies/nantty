import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCreateUploadIntentHandler } from "../../src/modules/internal/commands/createUploadIntent/createUploadIntent.handler.js";
import { createCompleteUploadSessionHandler } from "../../src/modules/uploads/commands/completeUploadSession/completeUploadSession.handler.js";
import { createHarness } from "../fakes/pipelineHarness.js";

describe("internal link preview image ingest", () => {
  it("lets a service upload a post image through an intent and complete it only as the same owner", async () => {
    const harness = createHarness();
    const ownerId = randomUUID();
    const intent = await createCreateUploadIntentHandler(harness.context)({ accountId: ownerId, purpose: "post", contentType: "image/jpeg", sizeBytes: 4, fileName: "link-preview" });
    expect(intent.publicUrl).toContain("display.jpg");
    const asset = harness.db.assets.get(intent.mediaId);
    expect(asset).toMatchObject({ purpose: "post", kind: "image" });
    await harness.storage.putObject(String(asset!["quarantineBucket"]), String(asset!["quarantineKey"]), { buffer: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) }, { contentType: "image/jpeg" });
    const complete = createCompleteUploadSessionHandler(harness.context);
    await expect(complete({ ownerId: randomUUID(), lookup: { mediaId: intent.mediaId } })).rejects.toMatchObject({ status: 404 });
    await expect(complete({ ownerId, lookup: { mediaId: intent.mediaId } })).resolves.toEqual({ mediaId: intent.mediaId, status: "processing" });
  });

  it("refuses non-image content for a post intent beyond the purpose limits", async () => {
    const harness = createHarness();
    await expect(createCreateUploadIntentHandler(harness.context)({ accountId: randomUUID(), purpose: "post", contentType: "application/pdf", sizeBytes: 10, fileName: undefined })).rejects.toMatchObject({ status: 415 });
  });
});
