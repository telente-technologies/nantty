import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";
import { adaptListEnvelope, toServerListEnvelope } from "@/utils/listEnvelope.util";

import { c, validateAgainstContract } from "./contractSchema.util";

const serverPage = c.object({ data: c.array(c.any()), nextCursor: c.nullable(c.string()), total: c.number() });

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: toServerListEnvelope(response.body) as Record<string, unknown> };
}

describe("ads mock responses match the contracts", () => {
  it("auth login, memberships and campaign list use the server envelopes", async () => {
    const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Nantty2026!" });
    assert.equal(login.status, 200);
    assert.deepEqual(validateAgainstContract(c.object({ accessToken: c.string(), refreshToken: c.string(), user: c.any() }), login.body), []);
    const headers = { authorization: `Bearer ${String(login.body.accessToken)}` };
    const memberships = await callMock("GET", "/ads/memberships", headers);
    assert.deepEqual(validateAgainstContract(c.object({ data: c.array(c.object({ accountId: c.string(), role: c.string() })), nextCursor: c.nullable(c.string()) }), memberships.body), []);
    const accountId = (memberships.body.data as { accountId: string }[])[0]!.accountId;
    const campaigns = await callMock("GET", `/ads/accounts/${accountId}/campaigns`, headers);
    assert.deepEqual(validateAgainstContract(serverPage, campaigns.body), []);
  });

  it("adaptListEnvelope maps the server envelope to the internal page shape", () => {
    const adapted = adaptListEnvelope<unknown>({ data: [1, 2], nextCursor: "n" }) as { items: number[]; nextCursor: string; total: number };
    assert.deepEqual(adapted.items, [1, 2]);
    assert.equal(adapted.total, 2);
    assert.equal(adapted.nextCursor, "n");
  });
});
