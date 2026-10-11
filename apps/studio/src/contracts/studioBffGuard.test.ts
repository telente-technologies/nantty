import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { forwardBffRequestToStudioApi } from "@/server/gateway.service";

const call = (method: string, path: string, headers: Record<string, string> = {}) =>
  forwardBffRequestToStudioApi(new NextRequest(`http://localhost:3600/bff${path}`, { method, headers }), path.split("/").filter(Boolean));

describe("studio BFF guard", () => {
  it("refuses endpoints that are not on the allow-list before touching the session", async () => {
    for (const [method, path] of [["GET", "/api/v1/orders"], ["POST", "/api/v1/wallets/me/withdrawals"], ["GET", "/api/v1/admin/users"], ["DELETE", "/api/v1/lives/live_1"]] as const) {
      const response = await call(method, path);
      assert.equal(response.status, 404, `${method} ${path}`);
      assert.equal(((await response.json()) as { code: string }).code, "NOT_AVAILABLE_IN_STUDIO");
    }
  });

  it("refuses path tricks", async () => {
    assert.equal((await call("GET", "/api/v1/lives/..%2F..%2Fadmin")).status, 404);
    assert.equal((await call("GET", "/api/v2/lives")).status, 404);
  });

  it("requires a session for allowed private endpoints", async () => {
    const response = await call("GET", "/api/v1/wallets/me");
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as { code: string }).code, "UNAUTHENTICATED");
  });

  it("serves the public overlay scene without a session", async () => {
    const response = await call("GET", "/api/v1/overlay-scenes/scene_live_1");
    assert.equal(response.status, 200);
  });
});
