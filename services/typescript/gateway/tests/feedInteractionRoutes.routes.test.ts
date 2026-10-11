import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";
import { shouldRefuseAnonymousMutation } from "../src/services/anonymousMutationGuard.service.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";

describe("feed interaction routes", () => {
  it("sends single and batched interactions to social and requires sign-in", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/feeds/interactions")).toMatchObject({ upstream: "social", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/feeds/interactions/batch")).toMatchObject({ upstream: "social", authentication: "required" });
  });

  it("keeps feed reads open to guests", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/feeds/for-you")).toMatchObject({ upstream: "social", authentication: "optional" });
  });

  it("refuses anonymous interaction writes before they reach social", () => {
    expect(shouldRefuseAnonymousMutation("POST", "/api/v1/feeds/interactions/batch", undefined)).toBe(true);
  });

  it("rate limits interactions per account", () => {
    expect(classifyRequestForRateLimit("POST", "/api/v1/feeds/interactions/batch")).toBe("feedInteraction");
    expect(classifyRequestForRateLimit("POST", "/api/v1/feeds/interactions")).toBe("feedInteraction");
    expect(classifyRequestForRateLimit("GET", "/api/v1/feeds/for-you")).toBeUndefined();
    expect(buildRouteRateLimitKey("feedInteraction", "1.2.3.4", "acct")).toBe("rl:route:feedInteraction:a:acct");
  });
});
