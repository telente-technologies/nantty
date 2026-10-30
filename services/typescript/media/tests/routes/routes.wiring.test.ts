import { describe, expect, it } from "vitest";

import { createHarness } from "../fakes/pipelineHarness.js";
import { createMediaHttpApp } from "../../src/httpApp.js";

describe("route wiring", () => {
  it("registers upload, asset, internal and health routes without conflicts", async () => {
    const harness = createHarness();
    const app = await createMediaHttpApp(harness.context);
    try {
      await app.ready();
      const routes = [
        ["GET", "/healthz"], ["GET", "/readyz"],
        ["POST", "/api/v1/media/uploads"],
        ["GET", "/api/v1/media/uploads/:uploadId"],
        ["DELETE", "/api/v1/media/uploads/:uploadId"],
        ["PUT", "/api/v1/media/uploads/:uploadId/chunks/:chunkIndex"],
        ["GET", "/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url"],
        ["POST", "/api/v1/media/uploads/:uploadId/chunks/urls"],
        ["POST", "/api/v1/media/uploads/:uploadId/complete"],
        ["POST", "/api/v1/media/:mediaId/complete"],
        ["GET", "/api/v1/media/:mediaId"],
        ["POST", "/internal/v1/media/intents"],
        ["POST", "/internal/v1/media/delete"],
        ["GET", "/internal/v1/media/:mediaId"],
        ["POST", "/internal/v1/media/:mediaId/signed-url"],
        ["POST", "/internal/v1/media/:mediaId/review"],
        ["POST", "/internal/v1/media/:mediaId/complete"],
        ["POST", "/internal/v1/media/:mediaId/audio-fingerprint"],
        ["POST", "/internal/v1/media/:mediaId/download-variant"],
      ] as const;
      for (const [method, url] of routes) expect(app.hasRoute({ method, url }), `${method} ${url}`).toBe(true);
    } finally { await app.close(); }
  });
});
