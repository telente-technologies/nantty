import assert from "node:assert/strict";
import test from "node:test";

import { androidBubblePreferenceLabel, androidConversationChannelDescription } from "./chatBubblesTroubleshooting.util";

test("Android bubble preference uses a user-readable label", () => {
  assert.equal(androidBubblePreferenceLabel(0), "Bubbles disabled for Messenger");
  assert.equal(androidBubblePreferenceLabel(1), "Android allows all eligible Messenger bubbles");
  assert.equal(androidBubblePreferenceLabel(2), "Only conversations selected in Android can bubble");
  assert.equal(androidBubblePreferenceLabel(undefined), "Android bubble preference unavailable");
  assert.equal(androidBubblePreferenceLabel(9), "Android bubble preference unavailable");
});

test("Android conversation channel diagnostics report the actual channel state", () => {
  assert.match(androidConversationChannelDescription("Nantty friend", { status: "available", channelExists: true, canBubble: true, importance: 4 }), /Nantty friend: Channel exists; channel permits bubbles; notification importance set to high/);
  assert.match(androidConversationChannelDescription("Nantty friend", { status: "available", channelExists: true, canBubble: false, importance: 0 }), /notifications blocked for this conversation/);
  assert.match(androidConversationChannelDescription(null, { status: "channel_not_created", channelExists: false, canBubble: null, importance: null }), /has not created/);
  assert.match(androidConversationChannelDescription(null, { status: "unsupported", channelExists: false, canBubble: null, importance: null }), /unsupported/);
});
