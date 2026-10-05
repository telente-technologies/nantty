import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCreateUploadIntentHandler } from "../../src/modules/internal/commands/createUploadIntent/createUploadIntent.handler.js";
import { createGetInternalMediaHandler } from "../../src/modules/internal/queries/getInternalMedia/getInternalMedia.handler.js";
import { createHarness } from "../fakes/pipelineHarness.js";

describe("internal media lookup", () => {
  it("tells other services who owns the media, its purpose, type and status", async () => {
    const harness = createHarness();
    const ownerId = randomUUID();
    const intent = await createCreateUploadIntentHandler(harness.context)({ accountId: ownerId, purpose: "post", contentType: "image/jpeg", sizeBytes: 4, fileName: "photo" });
    const view = await createGetInternalMediaHandler(harness.context)({ mediaId: intent.mediaId });
    expect(view).toMatchObject({ id: intent.mediaId, ownerId, purpose: "post", kind: "image", type: "image", mimeType: "image/jpeg", status: "uploading", sizeBytes: 4 });
  });

  it("answers 404 for unknown media", async () => {
    const harness = createHarness();
    await expect(createGetInternalMediaHandler(harness.context)({ mediaId: randomUUID() })).rejects.toMatchObject({ status: 404 });
  });
});
