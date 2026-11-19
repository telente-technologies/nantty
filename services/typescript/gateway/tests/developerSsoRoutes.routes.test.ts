import { describe, expect, it } from "vitest";
import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("developer SSO gateway routes", () => {
  it("allows the identity service to inspect browser cookies and redirect unauthenticated navigation", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/auth/sso/authorize")).toMatchObject({
      upstream: "identity",
      authentication: "optional",
    });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/auth/sso/token")).toMatchObject({
      upstream: "identity",
      authentication: "optional",
    });
  });
});
