import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";

import { validateAgainstContract } from "./contractSchema.util";
import { webappContracts } from "./webapp.contract";

describe("webapp mock responses match the contracts", () => {
  for (const contract of webappContracts) {
    it(`${contract.domain} ${contract.method} ${contract.path}`, async () => {
      const [path = "", search = ""] = contract.path.split("?");
      const body = contract.body === undefined ? null : new TextEncoder().encode(JSON.stringify(contract.body));
      const payload = await dispatchMockApiRequest(contract.method, path, new URLSearchParams(search), body);
      assert.deepEqual(validateAgainstContract(contract.schema, payload), []);
    });
  }
});
