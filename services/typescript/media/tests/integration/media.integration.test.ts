import { describe, expect, it } from "vitest";

import { createMediaApp } from "../../src/app.js";
import { loadMediaConfigFromEnvironment } from "../../src/configs/media.config.js";

describe.skipIf(process.env["RUN_INTEGRATION"] !== "1")("media service against Postgres and S3", () => {
  it("answers health and refuses anonymous uploads", async () => {
    const app = await createMediaApp({ ...loadMediaConfigFromEnvironment(), port: 0, jobsEnabled: false });
    const port = await app.start();
    try {
      expect((await fetch(`http://127.0.0.1:${port}/healthz`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/v1/media/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(401);
    } finally {
      await app.stop();
    }
  });
});
