import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./apiError";
import { conversationDisplayName, formatConversationTime, parseConversationList, type ConversationSummary } from "./conversations";

const directConversation: ConversationSummary = {
  id: "conversation-1",
  peer: { id: "user-1", name: "Ada Obi", username: "ada", avatarUrl: null, verified: false },
  lastMessage: "See you soon",
  lastMessageAt: "2026-11-13T10:00:00.000Z",
  unread: 2,
  kind: "direct",
};

test("conversation inbox contracts", async (t) => {
  await t.test("accepts the list and cursor-page shapes used by the Nantty API client", () => {
    assert.deepEqual(parseConversationList([directConversation]), [directConversation]);
    assert.deepEqual(parseConversationList({ data: [directConversation], nextCursor: "next" }), [directConversation]);
  });

  await t.test("rejects a response that cannot safely be rendered as real conversations", () => {
    assert.throws(() => parseConversationList({ data: [{ id: "incomplete" }] }), ApiError);
  });

  await t.test("uses the group title and business store name for inbox labels", () => {
    assert.equal(conversationDisplayName({ ...directConversation, kind: "group", title: "Design team" }), "Design team");
    assert.equal(conversationDisplayName({ ...directConversation, kind: "business", store: { id: "store-1", name: "Ada Studio" } }), "Ada Studio");
  });

  await t.test("formats valid timestamps and leaves invalid timestamps blank", () => {
    const now = Date.parse("2026-11-13T10:02:00.000Z");
    assert.equal(formatConversationTime("2026-11-13T10:00:00.000Z", now), "2m");
    assert.equal(formatConversationTime("not-a-date", now), "");
  });
});
