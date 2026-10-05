import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

const creatorId = "0192a4f0-0000-7000-8000-000000000001";

describe("creator money routes", () => {
  it("sends the creator program, subscriptions, tips and affiliates to go-money", () => {
    const signedIn: readonly [string, string][] = [
      ["GET", "/api/v1/creators/me"], ["GET", "/api/v1/creators/dashboard"], ["GET", "/api/v1/creators/earnings"], ["POST", "/api/v1/creators/earnings/convert"],
      ["GET", "/api/v1/creators/revenue-rules"], ["GET", "/api/v1/creators/affiliations"], ["POST", "/api/v1/creators/affiliations"], ["DELETE", "/api/v1/creators/affiliations/a1"],
      ["GET", "/api/v1/creators/me/affiliated-products"], ["GET", "/api/v1/creators/me/subscription-plans"], ["PATCH", "/api/v1/creators/me/subscription-plans/p1"],
      ["GET", "/api/v1/creators/me/subscribers"], [`POST`, `/api/v1/creators/${creatorId}/subscriptions`], ["GET", "/api/v1/creator-subscriptions"],
      ["POST", "/api/v1/creator-subscriptions/verify"], ["POST", "/api/v1/creator-subscriptions/s1/cancel"], ["GET", "/api/v1/subscriptions/s1"], ["POST", "/api/v1/tips"],
      ["GET", "/api/v1/seller/affiliates/overview"], ["PUT", "/api/v1/seller/affiliates/product-commissions/p1"], ["GET", "/api/v1/verification/plans"],
      ["POST", "/api/v1/verification/subscription/cancel"],
    ];
    for (const [method, path] of signedIn) {
      expect(resolveUpstreamRouteForRequest(method, path), `${method} ${path}`).toMatchObject({ upstream: "money", authentication: "required" });
    }
  });

  it("keeps public plans anonymous and leaves identity and live routes alone", () => {
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/creators/${creatorId}/subscription-plans`)).toMatchObject({ upstream: "money", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/creators/eligibility")).toMatchObject({ upstream: "identity" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/verification/me")).toMatchObject({ upstream: "identity" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/creators/me/analytics/gifts/streams/l1")).toMatchObject({ upstream: "live" });
  });
});
