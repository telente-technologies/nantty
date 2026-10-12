import { describe, expect, it } from "vitest";

import { buildRouteRateLimitKey, classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";

const token = "Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s";

describe("subscription offer link rate limits", () => {
  it("limits offer previews per client and claims per account", () => {
    expect(classifyRequestForRateLimit("GET", `/api/v1/subscription-offers/${token}`)).toBe("offerRead");
    expect(classifyRequestForRateLimit("POST", `/api/v1/subscription-offers/${token}/claim`)).toBe("offerClaim");
    expect(classifyRequestForRateLimit("GET", `/api/v1/subscription-offers/${token}/claim`)).toBeUndefined();
    expect(buildRouteRateLimitKey("offerRead", "10.0.0.1", "acct_1")).toBe("rl:route:offerRead:i:10.0.0.1");
    expect(buildRouteRateLimitKey("offerClaim", "10.0.0.1", "acct_1")).toBe("rl:route:offerClaim:a:acct_1");
  });
});
