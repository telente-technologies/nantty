import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

import { c, validateAgainstContract } from "./contractSchema.util";

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

describe("seller mock responses match the contracts", () => {
  it("auth login returns tokens and the current user", async () => {
    const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Nantty2026!" });
    assert.equal(login.status, 200);
    assert.deepEqual(validateAgainstContract(c.object({ accessToken: c.string(), refreshToken: c.string(), user: c.object({ id: c.string() }) }), login.body), []);
  });

  it("rejects bad credentials with the shared error shape", async () => {
    const failure = await callMock("POST", "/auth/login", {}, { identifier: "nobody@example.com", password: "wrong" });
    assert.equal(failure.status, 401);
    assert.deepEqual(validateAgainstContract(c.object({ message: c.string(), code: c.string() }), failure.body), []);
  });
});
