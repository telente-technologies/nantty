import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

import { validateAgainstContract } from "./contractSchema.util";
import { sellerDomainContracts } from "./sellerDomains.contract";

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const [pathname, search = ""] = path.replace(/^\/api\/v1/, "").split("?");
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path: pathname ?? "", query: new URLSearchParams(search), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body };
}

describe("newly backed seller domains: mock responses match the backend contracts", async () => {
  const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Zudomart2026!" });
  const token = (login.body as { accessToken: string }).accessToken;
  for (const contract of sellerDomainContracts) {
    it(`${contract.method} ${contract.path}`, async () => {
      const response = await callMock(contract.method, contract.path, { authorization: `Bearer ${token}` }, contract.body);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.deepEqual(validateAgainstContract(contract.schema, response.body), []);
    });
  }
});
