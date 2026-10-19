import { describe, expect, it } from "vitest";

import { doesAdminRequestNeedStaffToken } from "../src/services/adminStaffGate.service.js";
import { shouldRefuseAnonymousMutation } from "../src/services/anonymousMutationGuard.service.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit, defaultRouteLimitsPerMinute } from "../src/services/routeRateLimitPolicy.service.js";

const preAuthAdminPaths = [
  "/api/v1/admin/auth/login",
  "/api/v1/admin/auth/refresh",
  "/api/v1/admin/auth/accept-invitation",
  "/api/v1/admin/auth/mfa/verify",
  "/api/v1/admin/auth/mfa/enroll/start",
  "/api/v1/admin/auth/mfa/enroll/confirm",
  "/api/v1/admin/auth/mfa/webauthn/options",
];

describe("pre-auth admin endpoints", () => {
  it("put every code-taking admin step on the otp bucket", () => {
    expect(classifyRequestForRateLimit("POST", "/api/v1/admin/auth/mfa/verify")).toBe("otp");
    expect(classifyRequestForRateLimit("POST", "/api/v1/admin/auth/mfa/enroll/confirm")).toBe("otp");
  });

  it("put the other pre-auth admin steps on the login bucket", () => {
    for (const path of ["/api/v1/admin/auth/login", "/api/v1/admin/auth/refresh", "/api/v1/admin/auth/accept-invitation", "/api/v1/admin/auth/mfa/enroll/start", "/api/v1/admin/auth/mfa/webauthn/options"]) {
      expect(classifyRequestForRateLimit("POST", path), path).toBe("login");
    }
  });

  it("leaves no pre-auth admin path on the generic guest limit, and keys them by IP", () => {
    for (const path of preAuthAdminPaths) {
      expect(doesAdminRequestNeedStaffToken("POST", path), path).toBe(false);
      expect(shouldRefuseAnonymousMutation("POST", path, undefined), path).toBe(false);
      const bucket = classifyRequestForRateLimit("POST", path);
      expect(bucket, path).toBeDefined();
      expect(defaultRouteLimitsPerMinute[bucket!]).toBeLessThanOrEqual(10);
      expect(buildRouteRateLimitKey(bucket!, "1.2.3.4", "staff-1")).toBe(`rl:route:${bucket}:i:1.2.3.4`);
    }
  });

  it("does not treat staff-authenticated admin auth reads as pre-auth", () => {
    expect(classifyRequestForRateLimit("GET", "/api/v1/admin/auth/me")).toBeUndefined();
    expect(classifyRequestForRateLimit("OPTIONS", "/api/v1/admin/auth/login")).toBeUndefined();
  });
});
