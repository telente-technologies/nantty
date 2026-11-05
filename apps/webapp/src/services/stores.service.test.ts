import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { rememberCsrfTokenForRequests } from "./clientApi.service";
import { storesService } from "./stores.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  rememberCsrfTokenForRequests(null);
});

describe("store follow API", () => {
  it("uses the authenticated BFF endpoints and accepts canonical follow states", async () => {
    const storeId = "0192a4f0-0000-7000-8000-000000000000";
    const requests: Array<{ url: string; method: string | undefined }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requests.push({ url: String(input), method: init.method });
      const following = init.method === "POST";
      return new Response(JSON.stringify({ data: { storeId, isFollowing: following, followers: following ? 19 : 18 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    assert.deepEqual(await storesService.followStore(storeId), { storeId, isFollowing: true, followers: 19 });
    assert.deepEqual(await storesService.unfollowStore(storeId), { storeId, isFollowing: false, followers: 18 });
    assert.deepEqual(requests, [
      { url: `/bff/api/v1/stores/${storeId}/follow`, method: "POST" },
      { url: `/bff/api/v1/stores/${storeId}/follow`, method: "DELETE" },
    ]);
  });

  it("rejects malformed or mismatched mutation responses", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ storeId: "other", isFollowing: true, followers: -1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    await assert.rejects(storesService.followStore("0192a4f0-0000-7000-8000-000000000000"), /invalid store-follow state/i);
  });
});
