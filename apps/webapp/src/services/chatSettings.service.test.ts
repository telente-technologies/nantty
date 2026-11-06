import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { chatSettingsService } from "./chatGroups.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("chat settings service", () => {
  it("PATCHes only the group privacy preference and returns the server settings", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    const serverSettings = {
      messageRequestsFrom: "followers",
      preventDirectGroupAdds: true,
      notifications: { messages: true, requests: true, groups: true, streakReminders: false, showMessagePreview: true },
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(serverSettings), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const saved = await chatSettingsService.update({ preventDirectGroupAdds: true });

    assert.equal(requestUrl, "/bff/api/v1/chat/settings");
    assert.equal(requestInit.method, "PATCH");
    assert.deepEqual(JSON.parse(String(requestInit.body)), { preventDirectGroupAdds: true });
    assert.deepEqual(saved, serverSettings);
  });
});
