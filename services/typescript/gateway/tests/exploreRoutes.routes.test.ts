import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("explore routes", () => {
  it("sends the guest-viewable explore home to social as read-only", () => {
    for (const path of ["/api/v1/explore/trends", "/api/v1/explore/headlines", "/api/v1/explore/who-to-follow", "/api/v1/explore/posts-for-you", "/api/v1/explore/categories"]) {
      expect(resolveUpstreamRouteForRequest("GET", path)).toMatchObject({ upstream: "social", authentication: "optional" });
    }
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/explore/trends")?.upstream).not.toBe("social");
  });

  it("keeps ranking settings and trend moderation behind the admin service", () => {
    expect(resolveUpstreamRouteForRequest("PUT", "/api/v1/admin/trending/moderation")?.upstream).toBe("identity");
    expect(resolveUpstreamRouteForRequest("PUT", "/api/v1/admin/config/feed.ranking")?.upstream).toBe("identity");
  });
});
