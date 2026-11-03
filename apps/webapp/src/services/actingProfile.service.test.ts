import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { actingProfileService } from "./actingProfile.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("acting profile service", () => {
  it("switches using the authenticated acting-profile contract", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: "store_1", kind: "store", name: "My Store", handle: "my-store", avatarUrl: null, verification: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const profile = await actingProfileService.switchTo("store_1");

    assert.equal(profile.id, "store_1");
    assert.equal(calls[0]?.url, "/bff/api/v1/users/me/acting-profile");
    assert.equal(calls[0]?.init.method, "PUT");
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { profileId: "store_1" });
  });

  it("does not hide ownership failures from the server", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: "FORBIDDEN", message: "You can't act as that profile" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    await assert.rejects(actingProfileService.switchTo("someone-elses-store"), { code: "FORBIDDEN" });
  });
});
