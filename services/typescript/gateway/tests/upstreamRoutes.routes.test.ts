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
  ])("%s %s is not routed to go-money", (method, path) => {
    expect(resolveUpstreamRouteForRequest(method, path)?.upstream).not.toBe("money");
  });

  it.each([
    ["POST", "/webhooks/paystack"],
    ["POST", "/webhooks/store-notifications/apple_iap"],
  ])("provider webhooks go raw to go-money only: %s %s", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("money");
    expect(route?.rawBodyPassthrough).toBe(true);
  });

  it("does not route webhooks over GET or the legacy payments path without authentication", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/webhooks/paystack")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/payments/webhooks/paystack")?.authentication).toBe("required");
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

describe("social routes", () => {
  it.each([
    ["POST", "/api/v1/users/u_1/follow", "required"],
    ["GET", "/api/v1/users/u_1/followers", "optional"],
    ["GET", "/api/v1/users/me/follow-requests", "required"],
    ["GET", "/api/v1/users/me/blocked", "required"],
    ["GET", "/api/v1/posts/p_1/comments", "optional"],
    ["GET", "/api/v1/feeds/popular", "optional"],
    ["GET", "/api/v1/saves/collections", "required"],
    ["POST", "/api/v1/conversations/c_1/messages", "required"],
    ["POST", "/api/v1/reports", "required"],
  ])("%s %s goes to social (%s authentication)", (method, path, authentication) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("social");
    expect(route?.authentication).toBe(authentication);
  });

  it("keeps mention privacy and other user routes on identity", () => {
    expect(resolveUpstreamRouteForRequest("PUT", "/api/v1/users/me/mention-privacy")?.upstream).toBe("identity");
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/users/u_1")?.upstream).toBe("identity");
  });
});

describe("media routes", () => {
  it.each([
    ["POST", "/api/v1/media/uploads"],
    ["PUT", "/api/v1/media/uploads/up_1/chunks/0"],
    ["GET", "/api/v1/media/uploads/up_1/chunks/0/url"],
    ["POST", "/api/v1/media/uploads/up_1/complete"],
    ["GET", "/api/v1/media/med_1"],
  ])("%s %s goes to ts.media and requires a token", (method, path) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    expect(route?.upstream).toBe("media");
    expect(route?.authentication).toBe("required");
  });

  it("never exposes the internal media api", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/internal/v1/media/intents")).toBeUndefined();
  });
});
