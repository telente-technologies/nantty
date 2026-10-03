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
