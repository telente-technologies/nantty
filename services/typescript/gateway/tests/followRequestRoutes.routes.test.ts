import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit, defaultRouteLimitsPerMinute } from "../src/services/routeRateLimitPolicy.service.js";

const userId = "0192f0a0-0000-7000-8000-0000000000aa";
const requestId = "0192f0a0-0000-7000-8000-0000000000bb";

describe("private account follow request routes", () => {
  it("needs sign-in to follow, cancel, list and answer requests", () => {
    for (const method of ["POST", "DELETE"]) expect(resolveUpstreamRouteForRequest(method, `/api/v1/users/${userId}/follow`)).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me/follow-requests")).toMatchObject({ upstream: "social", authentication: "required" });
    for (const answer of ["accept", "reject"]) expect(resolveUpstreamRouteForRequest("POST", `/api/v1/follow-requests/${requestId}/${answer}`)).toMatchObject({ upstream: "social", authentication: "required" });
  });

  it("lets guests read the follow status, counts and the locked profile's story ring and live badge", () => {
    for (const path of ["follow-status", "followers", "following", "posts", "stories", "story-status"]) {
      expect(resolveUpstreamRouteForRequest("GET", `/api/v1/users/${userId}/${path}`)).toMatchObject({ upstream: "social", authentication: "optional" });
    }
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/users/${userId}/live`)).toMatchObject({ upstream: "live", authentication: "optional" });
  });

  it("rate-limits follow churn and request answers per account", () => {
    for (const [method, path] of [["POST", `/api/v1/users/${userId}/follow`], ["DELETE", `/api/v1/users/${userId}/follow`], ["POST", `/api/v1/follow-requests/${requestId}/accept`], ["POST", `/api/v1/follow-requests/${requestId}/reject`]] as const) {
      expect(classifyRequestForRateLimit(method, path)).toBe("followWrite");
    }
    expect(classifyRequestForRateLimit("GET", `/api/v1/users/${userId}/follow-status`)).toBeUndefined();
    expect(classifyRequestForRateLimit("GET", "/api/v1/users/me/follow-requests")).toBeUndefined();
    expect(defaultRouteLimitsPerMinute.followWrite).toBeLessThanOrEqual(30);
    expect(buildRouteRateLimitKey("followWrite", "10.0.0.1", "acct-1")).toBe("rl:route:followWrite:a:acct-1");
  });
});
