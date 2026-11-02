import assert from "node:assert/strict";
import test from "node:test";

import { conversationUnreadCount, conversationUnreadLabel } from "./conversationUnreadLabel";

test("unread badges keep an exact accessible label and cap only the visible count", () => {
  assert.equal(conversationUnreadLabel(0), null);
  assert.equal(conversationUnreadCount(0), "0");
  assert.equal(conversationUnreadLabel(8), "8 unread messages");
  assert.equal(conversationUnreadCount(8), "8");
  assert.equal(conversationUnreadLabel(124), "124 unread messages");
  assert.equal(conversationUnreadCount(124), "99+");
});
