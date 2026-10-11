import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Message } from "@/types";

import { buildChatThread, describeMessagePreview, groupFallbackName, liveUntilFromMinutes, validatePollDraft } from "./chatThread.util";

const at = (minute: number) => `2026-10-11T10:${String(minute).padStart(2, "0")}:00.000Z`;
const message = (id: string, senderId: string, minute: number, extra: Partial<Message> = {}): Message => ({ id, conversationId: "c1", senderId, text: "", createdAt: at(minute), kind: "text", ...extra });

describe("buildChatThread", () => {
  const poll = { question: "Where?", allowMultipleAnswers: false, options: [{ id: "a", text: "Lekki" }, { id: "b", text: "Ikeja" }] };
  const messages: Message[] = [
    message("ctl-3", "bola", 6, { kind: "control", control: { type: "pollVote", targetMessageId: "p1", optionIds: ["b"] } }),
    message("m1", "ada", 1, { text: "hi" }),
    message("p1", "ada", 2, { kind: "poll", poll }),
    message("ctl-1", "bola", 3, { kind: "control", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } }),
    message("ctl-2", "me", 4, { kind: "control", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } }),
    message("l1", "ada", 5, { kind: "liveLocation", location: { latitude: 6.5, longitude: 3.3, label: "Start", liveUntil: "2026-10-11T18:00:00.000Z" } }),
    message("ctl-4", "mallory", 7, { kind: "control", control: { type: "locationUpdate", targetMessageId: "l1", latitude: 1, longitude: 1, label: null } }),
    message("ctl-5", "ada", 8, { kind: "control", control: { type: "locationUpdate", targetMessageId: "l1", latitude: 6.6, longitude: 3.4, label: "Ikeja" } }),
    message("ctl-bad", "bola", 9, { kind: "control", control: null, decryptionNotice: "Couldn't decrypt" }),
  ];

  it("hides control messages and folds them into their targets", () => {
    const { visible } = buildChatThread(messages, "me", new Date(at(30)));
    assert.deepEqual(visible.map((entry) => entry.id), ["m1", "p1", "l1"]);
    assert.deepEqual(visible[0]?.reactions, [{ emoji: "🔥", count: 2, reactedByMe: true }]);
    assert.deepEqual(visible[1]?.pollTally?.map((option) => option.voteCount), [0, 1]);
    assert.equal(visible[2]?.liveLocation?.latitude, 6.6);
    assert.equal(visible[2]?.liveLocation?.stopped, false);
  });

  it("ends a live location when its sender stops it, ignoring others", () => {
    const stopped = buildChatThread([...messages, message("ctl-6", "bola", 10, { kind: "control", control: { type: "locationStop", targetMessageId: "l1" } })], "me", new Date(at(30)));
    assert.equal(stopped.visible[2]?.liveLocation?.stopped, false);
    const ended = buildChatThread([...messages, message("ctl-7", "ada", 11, { kind: "control", control: { type: "locationStop", targetMessageId: "l1" } })], "me", new Date(at(30)));
    assert.equal(ended.visible[2]?.liveLocation?.stopped, true);
  });

  it("dedupes repeated pages", () => {
    assert.equal(buildChatThread([...messages, ...messages], "me", new Date(at(30))).visible.length, 3);
  });
});

describe("chat display helpers", () => {
  it("names groups from members before the encrypted name is readable", () => {
    assert.equal(groupFallbackName([]), "Group");
    assert.equal(groupFallbackName(["Ada", "Bola"]), "Ada and Bola");
    assert.equal(groupFallbackName(["Ada", "Bola", "Chi", "Dayo"]), "Ada, Bola and 2 others");
  });
  it("validates poll drafts like the composer", () => {
    assert.equal(validatePollDraft("", ["a", "b"]), "Ask a question.");
    assert.equal(validatePollDraft("Q", ["a", ""]), "Add at least 2 options.");
    assert.equal(validatePollDraft("Q", ["a", "A"]), "Options must be different.");
    assert.equal(validatePollDraft("Q", ["a", "b"]), null);
  });
  it("caps live location at 8 hours and previews rich messages", () => {
    assert.equal(liveUntilFromMinutes(10_000, new Date(at(0))), "2026-10-11T18:00:00.000Z");
    assert.equal(describeMessagePreview(message("x", "a", 1, { kind: "poll", poll: { question: "Lunch?", allowMultipleAnswers: false, options: [] } })), "📊 Lunch?");
    assert.equal(describeMessagePreview(message("y", "a", 1, { kind: "location" })), "📍 Location");
  });
});
