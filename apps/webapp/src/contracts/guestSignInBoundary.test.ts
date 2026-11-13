import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicApiRead } from "@/config/guestBrowsing.config";
import { WebappRequestError, isSignInRequiredError } from "@/services/clientApi.service";
import { isPublicApiRequest } from "@/server/gateway.service";

describe("guest reads that need an account", () => {
  it("are not forwarded as anonymous reads, so the BFF answers with a sign-in error", () => {
    for (const path of ["/api/v1/lives/suggested", "/api/v1/users/suggested", "/api/v1/gifts", "/api/v1/lives/live_1/comments", "/api/v1/users/0f8a1c2e", "/api/v1/users/me/live", "/api/v1/users/me/stories", "/api/v1/users/0f8a1c2e/story-status/extra"]) {
      assert.equal(isPublicApiRead("GET", path), false, path);
    }
  });

  it("keep the public reads guests can see", () => {
    for (const path of ["/api/v1/lives/live_1", "/api/v1/users/by-username/ada", "/api/v1/posts/p1/comments", "/api/v1/products/p1", "/api/v1/products/p1/reviews", "/api/v1/products/p1/rating-summary", "/api/v1/mart/recommendations/for-you", "/api/v1/users/0f8a1c2e/live", "/api/v1/users/0f8a1c2e/stories", "/api/v1/users/0f8a1c2e/story-status"]) {
      assert.equal(isPublicApiRead("GET", path), true, path);
    }
    assert.equal(isPublicApiRead("GET", "/api/v1/products/p1/rating-summary/extra"), false);
  });

  it("let a guest who opens a creator's link record the click, but add nothing to a cart without signing in", () => {
    assert.equal(isPublicApiRead("POST", "/api/v1/affiliate-links/0192a4f0-0000-7000-8000-000000000001/clicks"), true);
    assert.equal(isPublicApiRead("POST", "/api/v1/affiliate-links/../clicks"), false);
    assert.equal(isPublicApiRead("POST", "/api/v1/cart/items"), false);
    assert.equal(isPublicApiRead("POST", "/api/v1/creators/me/affiliate-links"), false);
  });

  it("allows only the exact product-interaction endpoint as a public write", () => {
    assert.equal(isPublicApiRequest("POST", "/api/v1/analytics/product-interactions"), true);
    assert.equal(isPublicApiRequest("POST", "/api/v1/analytics/product-interactions/extra"), false);
    assert.equal(isPublicApiRequest("POST", "/api/v1/cart/items"), false);
  });

  it("allows signed ad telemetry through the guest BFF without opening authenticated ad management", () => {
    assert.equal(isPublicApiRequest("POST", "/api/v1/ads/events"), true);
    assert.equal(isPublicApiRequest("POST", "/api/v1/ads/events/extra"), false);
    assert.equal(isPublicApiRequest("GET", "/api/v1/ads/events"), false);
    assert.equal(isPublicApiRequest("POST", "/api/v1/ads/campaigns"), false);
  });

  it("recognise the sign-in errors the pages turn into a sign-in prompt", () => {
    assert.equal(isSignInRequiredError(new WebappRequestError(401, "UNAUTHENTICATED", "Sign in to continue.")), true);
    assert.equal(isSignInRequiredError(new WebappRequestError(401, "SESSION_EXPIRED", "Your session has ended.")), true);
    assert.equal(isSignInRequiredError(new WebappRequestError(403, "FORBIDDEN", "No.")), false);
    assert.equal(isSignInRequiredError(new Error("boom")), false);
  });
});
