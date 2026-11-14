import assert from "node:assert/strict";
import test from "node:test";

import { conversationBubbleDraftKey, isConversationBubbleEnabled, toggleConversationBubble, toggleInAppConversation, updateConversationDraft, type BubbleSelection } from "./chatBubblePreferences.util";

const base: BubbleSelection = { enabled: true, mode: "selected", conversationIds: ["one"], excludedConversationIds: [] };

test("selected mode enables only explicitly selected conversations", () => {
  assert.equal(isConversationBubbleEnabled(base, "one"), true);
  assert.equal(isConversationBubbleEnabled(base, "two"), false);
});

test("none is represented by selected mode with an empty selection", () => {
  assert.equal(isConversationBubbleEnabled({ ...base, conversationIds: [] }, "one"), false);
});

test("disabled master preference prevents any conversation bubble", () => {
  assert.equal(isConversationBubbleEnabled({ ...base, enabled: false }, "one"), false);
});

test("all mode honors exclusions and toggling updates only the target", () => {
  const all: BubbleSelection = { ...base, mode: "all", excludedConversationIds: ["one"] };
  assert.equal(isConversationBubbleEnabled(all, "one"), false);
  assert.equal(isConversationBubbleEnabled(all, "two"), true);
  assert.deepEqual(toggleConversationBubble(all, "one").excludedConversationIds, []);
  assert.deepEqual(toggleConversationBubble(all, "two").excludedConversationIds, ["one", "two"]);
});

test("bubble drafts remain scoped to their conversation when switching", () => {
  const first = updateConversationDraft({}, "one", "draft for one");
  const both = updateConversationDraft(first, "two", "draft for two");
  assert.deepEqual(both, { one: "draft for one", two: "draft for two" });
  assert.deepEqual(updateConversationDraft(both, "one", ""), { two: "draft for two" });
});

test("persisted bubble draft keys are isolated by account and conversation", () => {
  assert.notEqual(conversationBubbleDraftKey("account-a", "conversation-1"), conversationBubbleDraftKey("account-b", "conversation-1"));
  assert.notEqual(conversationBubbleDraftKey("account-a", "conversation-1"), conversationBubbleDraftKey("account-a", "conversation-2"));
  assert.notEqual(conversationBubbleDraftKey("a:b", "c"), conversationBubbleDraftKey("a", "b:c"));
});

test("in-app conversation selection changes independently of Android system selection", () => {
  const systemSelection = ["android-chat"];
  const inAppSelection = toggleInAppConversation([], "ios-chat");
  assert.deepEqual(inAppSelection, ["ios-chat"]);
  assert.deepEqual(systemSelection, ["android-chat"]);
  assert.deepEqual(toggleInAppConversation(inAppSelection, "ios-chat"), []);
});
