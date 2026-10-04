import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

const route = (method: string, path: string) => resolveUpstreamRouteForRequest(method, path);

describe("support and help centre routes", () => {
  it("lets guests read help content but requires an account to vote", () => {
    expect(route("GET", "/api/v1/help/categories")).toMatchObject({ upstream: "support", authentication: "optional" });
    expect(route("GET", "/api/v1/help/topics/how-escrow-protects-your-order")).toMatchObject({ upstream: "support", authentication: "optional" });
    expect(route("POST", "/api/v1/help/topics/0b3c5e6a-1111-4222-8333-123456789abc/votes")).toMatchObject({ upstream: "support", authentication: "required" });
    expect(route("POST", "/api/v1/help/topics")).toBeUndefined();
  });

  it("requires an account for every ticket route", () => {
    expect(route("GET", "/api/v1/support/tickets")).toMatchObject({ upstream: "support", authentication: "required" });
    expect(route("POST", "/api/v1/support/tickets/abc/messages")).toMatchObject({ upstream: "support", authentication: "required" });
  });

  it("sends admin support and help CMS routes to support, keeping support email on notifications", () => {
    expect(route("GET", "/api/v1/admin/support/tickets")).toMatchObject({ upstream: "support" });
    expect(route("POST", "/api/v1/admin/support/chats/abc/claim")).toMatchObject({ upstream: "support" });
    expect(route("PUT", "/api/v1/admin/help/topics/abc")).toMatchObject({ upstream: "support" });
    expect(route("GET", "/api/v1/admin/support/email/templates")).toMatchObject({ upstream: "notifications" });
  });
});
