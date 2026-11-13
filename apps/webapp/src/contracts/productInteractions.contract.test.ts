import assert from "node:assert/strict";
import test from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { receivedProductInteractions } from "@/mocks/privacy.mock";
import { isPublicApiRequest } from "@/server/gateway.service";

const path = "/api/v1/analytics/product-interactions";
const event = { event: "product.viewed", payload: { productId: "product_1" }, occurredAt: "2026-11-12T00:00:00.000Z" };

test("the BFF only exposes the exact product-interaction endpoint as a public write", () => {
  assert.equal(isPublicApiRequest("POST", path), true);
  assert.equal(isPublicApiRequest("POST", `${path}/extra`), false);
  assert.equal(isPublicApiRequest("GET", path), false);
});

test("the local API mock respects anonymous analytics consent", async () => {
  const initialCount = receivedProductInteractions.length;
  const rejected = await dispatchMockApiRequest("POST", path, new URLSearchParams(), new TextEncoder().encode(JSON.stringify({ events: [event] })), { "x-consent-analytics": "false" }) as { accepted: number; dropped: number };
  assert.deepEqual(rejected, { accepted: 0, dropped: 1 });
  assert.equal(receivedProductInteractions.length, initialCount);

  const accepted = await dispatchMockApiRequest("POST", path, new URLSearchParams(), new TextEncoder().encode(JSON.stringify({ events: [event] })), { "x-consent-analytics": "true", "x-consent-personalization": "false" }) as { accepted: number; dropped: number };
  assert.deepEqual(accepted, { accepted: 1, dropped: 0 });
  assert.equal(receivedProductInteractions.length, initialCount + 1);
});
