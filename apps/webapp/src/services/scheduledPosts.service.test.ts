import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { scheduledPostsService } from "./scheduledPosts.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("scheduled-post actions use the existing authenticated API contracts", async () => {
  const requests: { url: string; method: string; body?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET", ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    const payload = requests.length === 1
      ? { data: [], nextCursor: "next" }
      : requests.length === 2
        ? { id: "post/1", scheduledAt: "2026-11-03T12:00:00.000Z", status: "scheduled" }
        : requests.length === 3
          ? { id: "post/1", scheduledAt: "2026-11-03T12:00:00.000Z", status: "publishing" }
          : null;
    return new Response(payload === null ? null : JSON.stringify(payload), { status: requests.length === 4 ? 204 : 200 });
  }) as typeof fetch;

  const page = await scheduledPostsService.list("cursor 1");
  await scheduledPostsService.reschedule("post/1", "2026-11-03T12:00:00.000Z");
  await scheduledPostsService.publishNow("post/1");
  await scheduledPostsService.cancel("post/1");

  assert.deepEqual(page, { data: [], nextCursor: "next" });
  assert.deepEqual(requests.map(({ url, method }) => [url, method]), [
    ["/bff/api/v1/posts/scheduled?cursor=cursor+1&limit=20", "GET"],
    ["/bff/api/v1/posts/post%2F1/schedule", "PATCH"],
    ["/bff/api/v1/posts/post%2F1/schedule/publish-now", "POST"],
    ["/bff/api/v1/posts/post%2F1/schedule", "DELETE"],
  ]);
  assert.equal(requests[1]?.body, JSON.stringify({ scheduledAt: "2026-11-03T12:00:00.000Z" }));
  assert.equal(requests[2]?.body, "{}");
});
