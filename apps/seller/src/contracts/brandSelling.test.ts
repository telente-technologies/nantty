import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

describe("brand selling toggle in mock mode", async () => {
  const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Nantty2026!" });
  const authorization = `Bearer ${(login.body as { accessToken: string }).accessToken}`;
  const brands = await callMock("GET", "/seller/brands", { authorization });
  const owned = (brands.body.data as { id: string; myRole: string }[]).find((brand) => brand.myRole === "owner");

  it("needs the owner and a step-up, then flips sellingEnabled", async () => {
    assert.ok(owned, "the demo seller owns a brand");
    const path = `/brands/${owned.id}`;
    const withoutStepUp = await callMock("PATCH", path, { authorization }, { sellingEnabled: false });
    assert.equal(withoutStepUp.status, 403);
    assert.equal(withoutStepUp.body.code, "STEP_UP_REQUIRED");
    const invalid = await callMock("PATCH", path, { authorization, "x-step-up-token": "mock_su_test" }, {});
    assert.equal(invalid.status, 400);
    const off = await callMock("PATCH", path, { authorization, "x-step-up-token": "mock_su_test" }, { sellingEnabled: false });
    assert.equal(off.status, 200);
    assert.equal(off.body.sellingEnabled, false);
    const on = await callMock("PATCH", path, { authorization, "x-step-up-token": "mock_su_test" }, { sellingEnabled: true });
    assert.equal(on.body.sellingEnabled, true);
  });
});
