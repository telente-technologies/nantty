import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("identity routes", () => {
  it("lets guests read a public profile by id but keeps the viewer's own profile signed in", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/0192f1a0-0000-7000-8000-000000000001")).toMatchObject({ upstream: "identity", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me")).toMatchObject({ upstream: "identity", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("PATCH", "/api/v1/users/me")).toMatchObject({ upstream: "identity", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me/settings")).toMatchObject({ upstream: "identity", authentication: "required" });
  });

  it("keeps the social profile sub-routes and signed-in user routes where they were", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/abc/followers")).toMatchObject({ upstream: "social", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("PUT", "/api/v1/users/me/topics")).toMatchObject({ upstream: "identity", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/users/me/email/verification")).toMatchObject({ upstream: "identity", authentication: "required" });
  });

  it("serves the topic catalogue and profile sitemap to guests, read-only", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/topics")).toMatchObject({ upstream: "identity", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/sitemap/profiles")).toMatchObject({ upstream: "identity", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/topics")?.upstream).toBeUndefined();
  });
});
