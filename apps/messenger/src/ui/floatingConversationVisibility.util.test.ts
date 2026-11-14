import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowFloatingConversations } from "./floatingConversationVisibility.util";

test("in-app conversations remain available across chat and Stories sections", () => {
  assert.equal(shouldShowFloatingConversations("chats", false), true);
  assert.equal(shouldShowFloatingConversations("stories", false), true);
});

test("floating conversations stay hidden over settings and an open full conversation", () => {
  assert.equal(shouldShowFloatingConversations("settings", false), false);
  assert.equal(shouldShowFloatingConversations("chats", true), false);
});
