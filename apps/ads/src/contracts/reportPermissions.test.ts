import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { doesRoleHavePermission, findRequirementForApiCall } from "@/config/rolePermissions.config";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

describe("scheduled report permissions", () => {
  it("allows analysts to read reports but not create or delete scheduled reports", () => {
    assert.deepEqual(findRequirementForApiCall("GET", "/ads/accounts/act_demo/reports/scheduled"), {
      kind: "account", accountId: "act_demo", permission: "reports:view",
    });
    assert.deepEqual(findRequirementForApiCall("POST", "/ads/accounts/act_demo/reports/scheduled"), {
      kind: "account", accountId: "act_demo", permission: "reports:manage",
    });
    assert.deepEqual(findRequirementForApiCall("DELETE", "/ads/accounts/act_demo/reports/scheduled/report-123"), {
      kind: "account", accountId: "act_demo", permission: "reports:manage",
    });

    assert.equal(doesRoleHavePermission("analyst", "reports:view"), true);
    assert.equal(doesRoleHavePermission("analyst", "reports:manage"), false);
    assert.equal(doesRoleHavePermission("admin", "reports:manage"), true);
  });

  it("enforces the same read-only boundary in local mock mode", async () => {
    const login = await callMock("POST", "/auth/login", {}, { identifier: "blessing@ifelifestyle.ng", password: "Nantty2026!" });
    const headers = { authorization: `Bearer ${String(login.body.accessToken)}` };
    const path = "/ads/accounts/act_ifelifestyle/reports/scheduled";
    assert.equal((await callMock("GET", path, headers)).status, 200);
    const input = { name: "Unauthorized report", recipients: ["external@example.test"], frequency: "weekly", breakdown: "campaign", metrics: ["spend"] };
    assert.equal((await callMock("POST", path, headers, input)).status, 403);
    assert.equal((await callMock("DELETE", `${path}/report-id`, headers)).status, 403);
  });
});
