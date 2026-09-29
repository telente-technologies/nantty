import { createRouter } from "@zudojs/http";
import { afterAll, describe, expect, it } from "vitest";

import { registerRoutes } from "../../src/routes/index.js";
import { createTestApplication } from "../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

describe("route permissions", () => {
  it("declares a permission on every API route", () => {
    const router = createRouter();
    registerRoutes(router, app.dependencies);
    const undeclared = router
      .list()
      .filter((route) => route.path.startsWith("/api/v1"))
      .filter((route) => typeof route.metadata["permission"] !== "string")
      .map((route) => `${route.method} ${route.path}`);
    expect(undeclared).toEqual([]);
  });

  it("answers 401 to anonymous requests on protected routes", async () => {
    const protectedRequests: readonly [string, string][] = [
      ["GET", "/api/v1/users/me"],
      ["GET", "/api/v1/auth/sessions"],
      ["GET", "/api/v1/notifications"],
      ["GET", "/api/v1/conversations"],
      ["POST", "/api/v1/conversations"],
      ["GET", "/api/v1/messages/unread-count"],
      ["GET", "/api/v1/admin/audit-events"],
      ["GET", "/api/v1/admin/waitlist"],
    ];
    for (const [method, path] of protectedRequests) {
      await app.client.request(method, path).expect(401);
    }
  });
});
