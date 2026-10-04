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

describe("taken usernames carry suggestions", () => {
  it("returns three suggestions from the availability check and the register conflict", async () => {
    const availability = (await dispatchMockApiRequest("GET", "/api/v1/auth/username-available", new URLSearchParams({ username: "taken" }), null)) as { available: boolean; suggestions: string[] };
    assert.equal(availability.available, false);
    assert.equal(availability.suggestions.length, 3);
    assert.ok(!availability.suggestions.includes("taken"));
    const failure = await dispatchMockApiRequest("POST", "/api/v1/auth/register", new URLSearchParams(), new TextEncoder().encode(JSON.stringify({ username: "taken", email: "a@b.co" }))).catch((error: unknown) => error);
    assert.equal((failure as { code?: string }).code, "USERNAME_TAKEN");
    assert.equal((failure as { suggestions?: string[] }).suggestions?.length, 3);
  });
});
