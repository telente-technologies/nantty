import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("identity routes", () => {
  const cases: ReadonlyArray<readonly [string, string, "required" | "optional" | undefined]> = [
    ["POST", "/api/v1/auth/password/change", "required"],
    ["POST", "/api/v1/auth/password/reset", "optional"],
    ["POST", "/api/v1/auth/google", "optional"],
    ["GET", "/api/v1/auth/sessions", "required"],
    ["GET", "/api/v1/auth/username-suggestion", "optional"],
    ["GET", "/api/v1/users/me", "required"],
    ["PUT", "/api/v1/users/me/acting-profile", "required"],
    ["GET", "/api/v1/business-categories", "optional"],
    ["GET", "/api/v1/locale", "optional"],
    ["GET", "/api/v1/locale/countries", "optional"],
    ["GET", "/api/v1/currencies", "optional"],
    ["GET", "/api/v1/currency/convert", "optional"],
    ["POST", "/api/v1/admin/auth/login", "optional"],
    ["GET", "/api/v1/platform-config/creator-requirements", "optional"],
    ["GET", "/api/v1/internal/platform-config/gift.shareTiers", undefined],
    ["GET", "/api/v1/localeX", undefined],
  ];

  it.each(cases)("%s %s", (method, path, authentication) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.authentication).toBe(authentication);
    if (authentication !== undefined) expect(route?.upstream).toBe("identity");
  });
});

describe("live routes", () => {
  const liveCases: ReadonlyArray<readonly [string, string]> = [
    ["POST", "/api/v1/lives"],
    ["GET", "/api/v1/lives/suggested"],
    ["POST", "/api/v1/lives/abc/guests/invitations"],
    ["POST", "/api/v1/battles/abc/accept"],
    ["POST", "/api/v1/live/gifts"],
    ["GET", "/api/v1/gifts"],
    ["GET", "/api/v1/rankings"],
    ["GET", "/api/v1/creators/me/analytics/gifts/streams/abc"],
    ["DELETE", "/api/v1/admin/gifts/gift_rose"],
  ];

  it.each(liveCases)("%s %s goes to go-live and requires a token", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("live");
    expect(route?.authentication).toBe("required");
  });
});

describe("money routes", () => {
  it.each([
    ["GET", "/api/v1/orders/ord_1/escrow"],
    ["POST", "/api/v1/orders/ord_1/disputes"],
  ])("%s %s goes to go-money and requires a token", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("money");
    expect(route?.authentication).toBe("required");
  });

  it.each([
    ["POST", "/api/v1/orders/ord_1/escrow"],
    ["GET", "/api/v1/orders//escrow"],
    ["GET", "/api/v1/orders/ord_1/escrow/extra"],
    ["GET", "/api/v1/orders/ord_1/disputes"],
  ])("%s %s is not routed", (method, path) => {
    expect(resolveUpstreamRouteForRequest(method, path)).toBeUndefined();
  });

  it.each([
    ["POST", "/webhooks/bachs"],
    ["POST", "/webhooks/store-notifications/apple_iap"],
    ["POST", "/api/v1/payments/webhooks/bachs"],
  ])("provider webhooks never pass through the gateway: %s %s", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route === undefined || route.authentication === "required").toBe(true);
  });
});

describe("admin escrow routes", () => {
  it.each([
    ["GET", "/api/v1/admin/orders/ord_1/escrow"],
    ["POST", "/api/v1/admin/orders/ord_1/escrow/refund"],
  ])("%s %s goes to go-money with optional authentication", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("money");
    expect(route?.authentication).toBe("optional");
  });
});
