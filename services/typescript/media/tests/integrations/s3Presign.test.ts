import { describe, expect, it } from "vitest";

import { createS3ObjectStorage } from "../../src/integrations/s3ObjectStorage.integration.js";
import { testConfig } from "../fakes/pipelineHarness.js";

describe("s3 presigned uploads", () => {
  it("binds the declared content type and size into the signed PUT", async () => {
    const storage = createS3ObjectStorage({
      ...testConfig().storage,
      region: "us-east-1",
      endpoint: "http://127.0.0.1:9000",
      publicEndpoint: undefined,
      forcePathStyle: true,
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });

    const presigned = await storage.presignPut("nantty-media-quarantine", "owner/media/original", "image/png", 300, 12_345);

    expect(presigned.headers).toEqual({ "content-type": "image/png" });
    const url = new URL(presigned.url);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(decodeURIComponent(url.searchParams.get("X-Amz-SignedHeaders") ?? "")).toContain("content-type");
    expect(decodeURIComponent(url.searchParams.get("X-Amz-SignedHeaders") ?? "")).toContain("content-length");
  });
});
