import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { receivedMockAdEvents } from "@/mocks/adEvents.mock";
import { isPublicApiRequest } from "@/server/gateway.service";

const path = "/api/v1/ads/events";

describe("anonymous sponsored-ad event contract", () => {
  it("allows only the exact event-ingestion write through the public BFF allowlist", () => {
    assert.equal(isPublicApiRequest("POST", path), true);
    assert.equal(isPublicApiRequest("POST", `${path}/extra`), false);
    assert.equal(isPublicApiRequest("GET", path), false);
    assert.equal(isPublicApiRequest("POST", "/api/v1/ads/campaigns"), false);
  });

  it("records a guest event using the signed ad token contract", async () => {
    const initialCount = receivedMockAdEvents.length;
    const event = { campaignId: "campaign_guest_1", placement: "feed", type: "impression", itemId: "post_guest_1", token: "signed-impression-token" };
    await dispatchMockApiRequest("POST", path, new URLSearchParams(), new TextEncoder().encode(JSON.stringify({ events: [event] })));
    assert.equal(receivedMockAdEvents.length, initialCount + 1);
    assert.deepEqual(receivedMockAdEvents.at(-1), event);
  });
});
