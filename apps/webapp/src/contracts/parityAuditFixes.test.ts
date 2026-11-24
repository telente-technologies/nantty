import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const send = (method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body));

describe("PAR-001 to PAR-006 webapp mock routes", () => {
  it("resolves user clips via /api/v1/users/:userId/posts?kind=clip (PAR-001)", async () => {
    const result = (await send("GET", "/api/v1/users/u-1/posts", undefined, { kind: "clip" })) as { data: readonly unknown[] };
    assert.ok(Array.isArray(result.data));
  });

  it("resolves /api/v1/posts/:postId and /api/v1/feeds/popular (PAR-002)", async () => {
    const popular = (await send("GET", "/api/v1/feeds/popular")) as { data: readonly { id: string }[] };
    assert.ok(Array.isArray(popular.data) && popular.data.length > 0);
    const firstPost = (await send("GET", `/api/v1/posts/${popular.data[0]!.id}`)) as { id: string };
    assert.equal(firstPost.id, popular.data[0]!.id);
  });

  it("resolves /api/v1/users/me/suspension and /appeal (PAR-003)", async () => {
    const notice = (await send("GET", "/api/v1/users/me/suspension")) as { reason: string; retentionDays: number };
    assert.ok(notice.reason.length > 0 && notice.retentionDays > 0);
    const appeal = (await send("POST", "/api/v1/users/me/suspension/appeal", {
      message: "I removed the infringing media and reviewed community guidelines.",
    })) as { status: string };
    assert.equal(appeal.status, "received");
  });

  it("serves autocomplete suggestions on /api/v1/search/suggest (PAR-004)", async () => {
    const response = (await send("GET", "/api/v1/search/suggest", undefined, { q: "la" })) as { data: readonly { text: string }[] };
    assert.ok(Array.isArray(response.data));
  });

  it("serves moderation decisions and accepts appeals (PAR-005)", async () => {
    const list = (await send("GET", "/api/v1/moderation/decisions/me")) as { data: readonly { reportId: string }[] };
    assert.ok(list.data.length > 0);
    const appeal = (await send("POST", `/api/v1/moderation/decisions/${list.data[0]!.reportId}/appeal`, {
      message: "This post showed a genuine verified product specification.",
    })) as { status: string };
    assert.equal(appeal.status, "received");
  });

  it("accepts analytics telemetry events on POST /api/v1/analytics/events (PAR-006)", async () => {
    const res = (await send("POST", "/api/v1/analytics/events", {
      events: [{ eventType: "video_view", targetType: "clip", targetId: "c-1" }],
    })) as { accepted: number };
    assert.equal(res.accepted, 1);
  });
});
