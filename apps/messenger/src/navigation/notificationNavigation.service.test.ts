import assert from "node:assert/strict";
import test from "node:test";

import { conversationIdFromUrl, isBubbleTestUrl, isCompactBubbleUrl } from "./notificationNavigation.service";

test("bubble deep links select only the compact authorized conversation route", () => {
  const url = "nantty-messenger://chats/conversation%2F42?surface=bubble";
  assert.equal(conversationIdFromUrl(url), "conversation/42");
  assert.equal(isCompactBubbleUrl(url), true);
  assert.equal(isBubbleTestUrl(url), false);
  assert.equal(isCompactBubbleUrl("nantty-messenger://chats/conversation%2F42"), false);
});

test("invalid and unrelated links do not become conversation routes", () => {
  assert.equal(conversationIdFromUrl("nantty-messenger://stories"), null);
  assert.equal(conversationIdFromUrl("not a url"), null);
  assert.equal(isCompactBubbleUrl("not a url"), false);
  assert.equal(isBubbleTestUrl("nantty-messenger://test-chat?surface=bubble-test"), true);
});
