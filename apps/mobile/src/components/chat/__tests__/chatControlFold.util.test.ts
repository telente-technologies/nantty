import type { LocallyStoredMessage } from "@/cache/messageHistory.type";

import { foldConversationMessages, myCurrentVote } from "../chatControlFold.util";

const base = (id: string, senderId: string, minute: number, extra: Partial<LocallyStoredMessage> = {}): LocallyStoredMessage => ({
  id, conversationId: "c1", senderId, text: "", createdAt: `2026-10-11T10:${String(minute).padStart(2, "0")}:00.000Z`, deliveryStatus: "sent", ...extra,
});
const control = (id: string, senderId: string, minute: number, value: NonNullable<LocallyStoredMessage["control"]>, extra: Partial<LocallyStoredMessage> = {}) =>
  base(id, senderId, minute, { kind: "control", control: value, ...extra });

const poll = { question: "Which fabric?", allowMultipleAnswers: false, options: [{ id: "a", text: "Ankara" }, { id: "b", text: "Lace" }] };

describe("folding encrypted control messages", () => {
  const messages = [
    base("m1", "ada", 0, { kind: "text", text: "hi" }),
    base("p1", "ada", 1, { kind: "poll", pollDefinition: poll }),
    base("l1", "ada", 2, { kind: "liveLocation", location: { latitude: 6.5, longitude: 3.3, address: "Yaba", liveUntil: "2026-10-11T18:00:00.000Z" } }),
    control("c1", "bola", 3, { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false }),
    control("c2", "me", 4, { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false }),
    control("c3", "me", 5, { type: "pollVote", targetMessageId: "p1", optionIds: ["b"] }),
    control("c4", "bola", 6, { type: "pollVote", targetMessageId: "p1", optionIds: ["not-an-option"] }),
    control("c5", "mallory", 7, { type: "locationUpdate", targetMessageId: "l1", latitude: 1, longitude: 1, label: "Fake" }),
    control("c6", "ada", 8, { type: "locationUpdate", targetMessageId: "l1", latitude: 6.6, longitude: 3.4, label: "Ikeja" }),
    control("c7", "me", 9, { type: "reaction", targetMessageId: "m1", emoji: "❤️", remove: false }, { deliveryStatus: "failed" }),
  ];
  const now = new Date("2026-10-11T11:00:00.000Z");

  it("hides control messages and applies reactions, ignoring failed sends", () => {
    const { visibleMessages } = foldConversationMessages(messages, "me", now);
    expect(visibleMessages.map((message) => message.id)).toEqual(["m1", "p1", "l1"]);
    expect(visibleMessages[0]?.reactions).toEqual([{ emoji: "🔥", count: 2, reactedByMe: true }]);
  });

  it("tallies poll votes and ignores votes for options that do not exist", () => {
    const pollMessage = foldConversationMessages(messages, "me", now).visibleMessages[1]!;
    expect(pollMessage.poll?.options).toEqual([{ id: "a", text: "Ankara", voteCount: 0, votedByMe: false }, { id: "b", text: "Lace", voteCount: 1, votedByMe: true }]);
    expect(myCurrentVote(messages, "p1", "me")).toEqual(["b"]);
  });

  it("only lets the sharer move or stop a live location", () => {
    const live = foldConversationMessages(messages, "me", now).visibleMessages[2]!;
    expect(live.location).toMatchObject({ latitude: 6.6, longitude: 3.4, address: "Ikeja", liveUntil: "2026-10-11T18:00:00.000Z" });
    const stoppedByStranger = foldConversationMessages([...messages, control("c8", "mallory", 10, { type: "locationStop", targetMessageId: "l1" })], "me", now).visibleMessages[2]!;
    expect(stoppedByStranger.location?.liveUntil).toBe("2026-10-11T18:00:00.000Z");
    const stopped = foldConversationMessages([...messages, control("c9", "ada", 11, { type: "locationStop", targetMessageId: "l1" })], "me", now).visibleMessages[2]!;
    expect((stopped.location?.liveUntil ?? "") <= now.toISOString()).toBe(true);
  });

  it("removes a reaction when the same person sends a removal", () => {
    const folded = foldConversationMessages([...messages, control("c10", "me", 12, { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: true })], "me", now);
    expect(folded.visibleMessages[0]?.reactions).toEqual([{ emoji: "🔥", count: 1, reactedByMe: false }]);
  });
});
