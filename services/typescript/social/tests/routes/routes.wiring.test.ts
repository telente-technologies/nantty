import { createRouter } from "@zudojs/http";
import { describe, expect, it } from "vitest";

import type { SocialDatabase } from "../../src/databases/prisma.database.js";
import { registerRoutes } from "../../src/routes/index.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

describe("route wiring", () => {
  it("registers every module without conflicting routes", () => {
    const database = {} as SocialDatabase;
    const router = createRouter({});
    expect(() => registerRoutes(router, createRouteFactory({ run: async (_a, _k, _p, execute) => ({ ...(await execute()), replayed: false }) }), {} as HandlerContext, database, "token")).not.toThrow();
  });
});
