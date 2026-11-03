import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { channelsService } from "./channels.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("broadcast channels", () => {
  it("creates a channel through the shared channel endpoint", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ id: "channel_1", kind: "channel", title: "Updates" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const channel = await channelsService.createBroadcastChannel({ name: "Updates", description: "News" });

    assert.equal(requestUrl, "/bff/api/v1/channels");
    assert.equal(requestInit.method, "POST");
    assert.deepEqual(JSON.parse(String(requestInit.body)), { name: "Updates", description: "News" });
    assert.equal(channel.id, "channel_1");
  });
});
