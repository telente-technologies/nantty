import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("gold for all your businesses routes", () => {
  it("sends the combined Gold overview, quote, checkout and coverage changes to go-money, signed in only", () => {
    const signedIn: readonly [string, string][] = [
      ["GET", "/api/v1/subscriptions/gold-for-businesses"], ["POST", "/api/v1/subscriptions/gold-for-businesses/quote"],
      ["POST", "/api/v1/subscriptions/gold-for-businesses/checkout"], ["PUT", "/api/v1/subscriptions/gold-for-businesses/s1/profiles"],
    ];
    for (const [method, path] of signedIn) {
      expect(resolveUpstreamRouteForRequest(method, path), `${method} ${path}`).toMatchObject({ upstream: "money", authentication: "required" });
    }
  });

  it("keeps the linked profile allowance on identity", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me/linked-profiles")).toMatchObject({ authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/me/linked-profiles")?.upstream).not.toBe("money");
  });
});
