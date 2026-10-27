import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";

describe("seller dashboard routes", () => {
  it("sends every newly backed seller domain to go-commerce behind a signed-in session", () => {
    const paths = ["/api/v1/seller/settings", "/api/v1/seller/storefront", "/api/v1/seller/staff", "/api/v1/seller/staff/candidates", "/api/v1/seller/audit-log", "/api/v1/seller/nantty-users", "/api/v1/seller/nantty-users",
      "/api/v1/seller/wallet/balances", "/api/v1/seller/finance/summary", "/api/v1/seller/dashboard", "/api/v1/seller/analytics/overview", "/api/v1/seller/delivery/areas", "/api/v1/stores/team-requests"];
    for (const path of paths) {
      expect(resolveUpstreamRouteForRequest("GET", path), path).toMatchObject({ upstream: "commerce", authentication: "required" });
    }
  });

  it("keeps finance read-only and payout onboarding on go-money", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/seller/finance/summary")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("PUT", "/api/v1/payments/payout-onboarding/me/bank")).toMatchObject({ upstream: "money", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/stores/0192a4f0-0000-7000-8000-000000000000")).toMatchObject({ upstream: "commerce", authentication: "optional" });
  });

  it("rate limits people search, team changes and money moves per account", () => {
    expect(classifyRequestForRateLimit("GET", "/api/v1/seller/nantty-users")).toBe("sellerPeopleSearch");
    expect(classifyRequestForRateLimit("GET", "/api/v1/seller/nantty-users")).toBe("sellerPeopleSearch");
    expect(classifyRequestForRateLimit("PATCH", "/api/v1/seller/staff/abc")).toBe("sellerTeamWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/stores/team-requests/abc/accept")).toBe("sellerTeamWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/seller/wallet/payouts")).toBe("sellerMoneyWrite");
    expect(classifyRequestForRateLimit("GET", "/api/v1/seller/wallet/payouts")).toBeUndefined();
    expect(buildRouteRateLimitKey("sellerMoneyWrite", "203.0.113.1", "account-1")).toBe("rl:route:sellerMoneyWrite:a:account-1");
  });
});
