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

  it("never exposes social internal routes", () => {
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/internal/conversations/${storeId}/members/${storeId}`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/internal/stores/${storeId}/follow-stats`)).toBeUndefined();
  });
});
