import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicApiRead } from "@/config/guestBrowsing.config";
import { WebappRequestError, isSignInRequiredError } from "@/services/clientApi.service";

describe("guest reads that need an account", () => {
  it("are not forwarded as anonymous reads, so the BFF answers with a sign-in error", () => {
    for (const path of ["/api/v1/lives/suggested", "/api/v1/users/suggested", "/api/v1/gifts", "/api/v1/lives/live_1/comments", "/api/v1/users/0f8a1c2e"]) {
      assert.equal(isPublicApiRead("GET", path), false, path);
    }
  });

  it("keep the public reads guests can see", () => {
    for (const path of ["/api/v1/lives/live_1", "/api/v1/users/by-username/ada", "/api/v1/posts/p1/comments", "/api/v1/products/p1"]) {
      assert.equal(isPublicApiRead("GET", path), true, path);
    }
  });

  it("recognise the sign-in errors the pages turn into a sign-in prompt", () => {
    assert.equal(isSignInRequiredError(new WebappRequestError(401, "UNAUTHENTICATED", "Sign in to continue.")), true);
    assert.equal(isSignInRequiredError(new WebappRequestError(401, "SESSION_EXPIRED", "Your session has ended.")), true);
    assert.equal(isSignInRequiredError(new WebappRequestError(403, "FORBIDDEN", "No.")), false);
    assert.equal(isSignInRequiredError(new Error("boom")), false);
  });
});
