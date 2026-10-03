import { createRouter } from "@zudojs/http";
import { describe, expect, it } from "vitest";

import { registerRoutes } from "../../src/routes/index.js";
import { createRouteFactory } from "../../src/utils/route.util.js";
import { createHarness } from "../fakes/pipelineHarness.js";

describe("route wiring", () => {
  it("registers upload, asset, internal and health routes without conflicts", () => {
    const harness = createHarness();
    const router = createRouter({});
    expect(() => registerRoutes(router, createRouteFactory("token"), harness.context, harness.db.database)).not.toThrow();
  });
});
