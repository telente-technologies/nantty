import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { composerService } from "./composer.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("publishing as an acting profile", () => {
  it("sends the selected profile id with the existing post request", async () => {
    let request: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      request = { url: String(input), init };
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    await composerService.publishPost({
      text: "A store update",
      mediaIds: [],
      audience: "everyone",
      kind: "post",
      asProfileId: "store_1",
    }, "post-idempotency-test");

    assert.equal(request?.url, "/bff/api/v1/posts");
    assert.equal(request?.init.method, "POST");
    assert.equal(request?.init.headers && new Headers(request.init.headers).get("Idempotency-Key"), "post-idempotency-test");
    assert.equal(JSON.parse(String(request?.init.body)).asProfileId, "store_1");
  });
});
