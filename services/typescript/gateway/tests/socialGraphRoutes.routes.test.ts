import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

const storeId = "0192f0a0-0000-7000-8000-0000000000aa";

describe("social graph routes", () => {
  it("sends store follows to social, ahead of the commerce store routes", () => {
    expect(resolveUpstreamRouteForRequest("POST", `/api/v1/stores/${storeId}/follow`)).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("DELETE", `/api/v1/stores/${storeId}/follow`)).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/stores/${storeId}/followers`)).toMatchObject({ upstream: "social", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/stores/${storeId}/follow-status`)).toMatchObject({ upstream: "social", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/stores/${storeId}`)?.upstream).toBe("commerce");
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/stores/${storeId}/products`)?.upstream).toBe("commerce");
  });

  it("sends connections tabs and broadcast channels to social", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me/connections")).toMatchObject({ upstream: "social", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/channels")).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("DELETE", `/api/v1/channels/${storeId}/subscribe`)).toMatchObject({ upstream: "social", authentication: "required" });
  });

  it("serves the profile avatar story and live status to guests and members, without touching identity", () => {
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/users/${storeId}/story-status`)).toMatchObject({ upstream: "social", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/users/${storeId}/live`)).toMatchObject({ upstream: "live", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("POST", `/api/v1/users/${storeId}/live`)?.upstream).toBe("identity");
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/users/${storeId}/live/extra`)?.upstream).not.toBe("live");
  });

  it("requires sign-in for per-post notification mutes", () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      expect(resolveUpstreamRouteForRequest(method, `/api/v1/posts/${storeId}/notifications-mute`)).toMatchObject({ upstream: "social", authentication: "required" });
    }
  });

  it("sends place search to social for signed-in readers only", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/places/search")).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/places/search")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/places/search/extra")).toBeUndefined();
  });

  it("never exposes social internal routes", () => {
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/internal/conversations/${storeId}/members/${storeId}`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/internal/stores/${storeId}/follow-stats`)).toBeUndefined();
  });
});
