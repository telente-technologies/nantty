import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { registerEventOperationsMockHandlers } from "@/mocks/handlers/platform/eventOperations.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockRequest } from "@/mocks/mockRouter.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";

describe("event operations mock API", () => {
  it("returns queue counters and consumer registrations without exposing broker internals or message bodies", async () => {
    clearEveryMockRoute();
    registerEventOperationsMockHandlers();
    const matched = findMockRouteForRequest("GET", "/admin/event-operations/queues");
    assert.ok(matched);
    const request: MockRequest = {
      method: "GET",
      path: "/admin/event-operations/queues",
      params: {},
      query: new URLSearchParams(),
      jsonBody: null,
      headers: new Headers(),
      principal: { adminId: "admin_ops", name: "Ops", email: "ops@nantty.test", role: "ADMIN", permissions: ["events:read"], sessionId: "session_ops" },
    };

    const response = await matched.route.handler(request);
    assert.equal(response.status, 200);
    assert.ok(response.body && typeof response.body === "object");
    const body = response.body as {
      data?: readonly Record<string, unknown>[];
      summary?: Record<string, unknown>;
      consumers?: { status?: string; registrations?: readonly Record<string, unknown>[] };
    };
    assert.equal(body.data?.length, 3);
    assert.equal(body.summary?.deadLetterReadyMessages, 2);
    assert.ok(body.data?.every((queue) => !("payload" in queue) && !("messageBody" in queue)));
    assert.equal(body.consumers?.status, "available");
    assert.ok((body.consumers?.registrations?.length ?? 0) > 0);
    assert.ok(body.consumers?.registrations?.every((consumer) => !("consumerTag" in consumer) && !("channel" in consumer)));
    assert.ok(body.consumers?.registrations?.every((consumer) => ["queueName", "ackRequired", "prefetchCount", "exclusive"].every((key) => key in consumer)));
  });

  it("rejects staff without events:read", async () => {
    clearEveryMockRoute();
    registerEventOperationsMockHandlers();
    const matched = findMockRouteForRequest("GET", "/admin/event-operations/queues");
    assert.ok(matched);
    const request: MockRequest = {
      method: "GET",
      path: "/admin/event-operations/queues",
      params: {},
      query: new URLSearchParams(),
      jsonBody: null,
      headers: new Headers(),
      principal: { adminId: "admin_support", name: "Support", email: "support@nantty.test", role: "SUPPORT", permissions: ["support:tickets"], sessionId: "session_support" },
    };
    await assert.rejects(Promise.resolve().then(() => matched.route.handler(request)), (error: unknown) => error instanceof MockHttpError && error.status === 403);
  });
});
