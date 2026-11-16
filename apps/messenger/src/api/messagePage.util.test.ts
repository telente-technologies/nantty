import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./apiError";
import { parseMessagePagePayload } from "./messagePage.util";

test("encrypted message page response contract", async (t) => {
  await t.test("preserves the backend cursor for older-message paging", () => {
    const data = [{ id: "newest" }, { id: "older" }];
    assert.deepEqual(parseMessagePagePayload({ data, nextCursor: "older" }), { data, nextCursor: "older" });
  });

  await t.test("accepts legacy array responses without inventing a cursor", () => {
    const data = [{ id: "message-1" }];
    assert.deepEqual(parseMessagePagePayload(data), { data, nextCursor: null });
  });

  await t.test("rejects malformed API payloads", () => {
    assert.throws(() => parseMessagePagePayload({ data: "not-a-list" }), ApiError);
  });
});
