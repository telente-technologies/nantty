import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Message } from "@/types";

import { buildChatThread } from "./chatThread.util";
import { buildPendingMessage, insertConfirmedMessage, isLocalMessage, mergeOptimisticMessages, rollsBackOnFailure } from "./chatOptimistic.util";

const now = new Date("2026-10-11T10:00:00.000Z");
const server = (id: string, extra: Partial<Message> = {}): Message => ({ id, conversationId: "c1", senderId: "me", text: "", createdAt: "2026-10-11T09:59:00.000Z", kind: "text", ...extra });

describe("optimistic chat sends", () => {
  it("shows a pending message at once and drops it when the server copy arrives", () => {
    const pending = buildPendingMessage("msg-1", "c1", "me", { kind: "text", text: "On my way" }, now);
    assert.equal(pending.deliveryState, "pending");
    assert.ok(isLocalMessage(pending));
    assert.deepEqual(mergeOptimisticMessages([server("m1")], [pending]).map((message) => message.id), ["m1", "local:msg-1"]);
    const confirmed = server("m2", { clientMessageId: "msg-1", text: "On my way" });
    assert.deepEqual(mergeOptimisticMessages([server("m1"), confirmed], [pending]).map((message) => message.id), ["m1", "m2"]);
  });

  it("inserts the confirmed message once, even when the refresh already has it", () => {
    const pages = [{ data: [server("m1")] }, { data: [server("m0")] }];
    const inserted = insertConfirmedMessage(pages, server("m2"));
    assert.deepEqual(inserted[0]?.data.map((message) => message.id), ["m1", "m2"]);
    assert.equal(insertConfirmedMessage(inserted, server("m2"))[0]?.data.length, 2);
    assert.deepEqual(insertConfirmedMessage([], server("m3"))[0]?.data.map((message) => message.id), ["m3"]);
  });

  it("applies a pending reaction immediately and rolls it back when the send fails", () => {
    const target = server("m1", { senderId: "ada" });
    const reaction = buildPendingMessage("msg-2", "c1", "me", { kind: "control", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } }, now);
    assert.equal(rollsBackOnFailure(reaction), true);
    assert.equal(rollsBackOnFailure({ kind: "text" }), false);
    const withPending = buildChatThread(mergeOptimisticMessages([target], [reaction]), "me", now);
    assert.deepEqual(withPending.visible.map((message) => message.id), ["m1"]);
    assert.deepEqual(withPending.visible[0]?.reactions, [{ emoji: "🔥", count: 1, reactedByMe: true }]);
    const rolledBack = buildChatThread(mergeOptimisticMessages([target], []), "me", now);
    assert.deepEqual(rolledBack.visible[0]?.reactions, []);
  });
});
