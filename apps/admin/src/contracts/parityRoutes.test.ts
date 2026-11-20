import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { doesApiCallRequireStepUp, findAdminApiRoute } from "@/config/apiAccess.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { registerEveryMockHandler } from "@/mocks/mockHandlerRegistry.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockPrincipal } from "@/mocks/mockRouter.mock";

const superPrincipal: MockPrincipal = {
  adminId: "adm_test_1",
  name: "Test Superadmin",
  email: "admin@nantty.test",
  role: "SUPERADMIN",
  permissions: ["users:suspend", "users:moderate", "applications:creators", "moderation:appeals", "moderation:reports", "payments:wallets", "support:email", "ads:review", "config:revenue", "config:read", "config:rules", "payouts:approve"],
  sessionId: "sess_test_1",
};

describe("PAR-007 & PAR-015 admin parity routes", () => {
  const expectedRoutes = [
    { method: "PUT", path: "/admin/account-health/usr_0025/monetisation-override", stepUp: true },
    { method: "DELETE", path: "/admin/account-health/usr_0025/monetisation-override", stepUp: true },
    { method: "GET", path: "/admin/moderation/child-safety/quarantine", stepUp: false },
    { method: "GET", path: "/admin/payments/payout-accounts/stuck", stepUp: false },
    { method: "POST", path: "/admin/payments/payout-accounts/jobs/pjob_901/retry", stepUp: true },
    { method: "POST", path: "/admin/payments/payout-accounts/usr_creator_104/verification-prompt", stepUp: true },
    { method: "POST", path: "/admin/payments/reconciliations", stepUp: true },
    { method: "GET", path: "/admin/support/notifications/push/deliveries/failed", stepUp: false },
    { method: "POST", path: "/admin/ads/ad_001/appeal/resolve", stepUp: false },
    { method: "GET", path: "/admin/ads-policies", stepUp: false },
    { method: "PUT", path: "/admin/ads-policies/frequency/feed", stepUp: false },
    { method: "GET", path: "/admin/wallet/seller-reserves", stepUp: false },
    { method: "PUT", path: "/admin/wallet/seller-reserves/usr_seller_209", stepUp: true },
    { method: "DELETE", path: "/admin/wallet/seller-reserves/usr_seller_209", stepUp: true },
    { method: "GET", path: "/admin/retention-policies", stepUp: false },
    { method: "PUT", path: "/admin/retention-policies/profile_and_posts", stepUp: true },
    { method: "GET", path: "/admin/creators/usr_0025/violations", stepUp: false },
    { method: "POST", path: "/admin/creators/usr_0025/violations", stepUp: true },
  ] as const;

  it("registers every PAR-007 & PAR-015 route in apiRoutes.config with expected sensitivity", () => {
    for (const route of expectedRoutes) {
      const rule = findAdminApiRoute(route.method, route.path);
      assert.ok(rule, `Missing route rule for ${route.method} ${route.path}`);
      assert.equal(doesApiCallRequireStepUp(route.method, route.path), route.stepUp, `Unexpected step-up flag on ${route.method} ${route.path}`);
    }
  });

  it("serves mock responses for all PAR-007 & PAR-015 routes", async () => {
    clearEveryMockRoute();
    registerEveryMockHandler();
    readMockDatabase().stepUpTokens.set("stepup-test-token", {
      adminId: superPrincipal.adminId,
      sessionId: superPrincipal.sessionId,
      expiresAtEpochMs: Date.now() + 60_000,
    });
    const headers = new Headers({ "x-step-up-token": "stepup-test-token" });

    for (const [method, path, jsonBody, expectedStatus] of [
      ["GET", "/admin/payments/payout-accounts/stuck", undefined, 200],
      ["POST", "/admin/payments/reconciliations", { reason: "Scheduled balance mirror audit" }, 200],
      ["GET", "/admin/support/notifications/push/deliveries/failed", undefined, 200],
      ["GET", "/admin/moderation/child-safety/quarantine", undefined, 200],
      ["PUT", "/admin/account-health/usr_0025/monetisation-override", { mode: "PAUSE", reason: "Manual policy review hold" }, 200],
      ["GET", "/admin/ads-policies", undefined, 200],
      ["GET", "/admin/wallet/seller-reserves", undefined, 200],
      ["DELETE", "/admin/wallet/seller-reserves/usr_seller_209", { reason: "Reserve hold completed cleanly" }, 204],
      ["GET", "/admin/retention-policies", undefined, 200],
      ["POST", "/admin/creators/usr_0025/violations", { reason: "Repeated undisclosed sponsored promotion" }, 201],
      ["GET", "/admin/creators/usr_0025/violations", undefined, 200],
    ] as const) {
      const match = findMockRouteForRequest(method, path);
      assert.ok(match, `Missing mock route for ${method} ${path}`);
      const res = await match.route.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(),
        jsonBody,
        headers,
        principal: superPrincipal,
      });
      assert.equal(res.status, expectedStatus);
    }
  });
});
