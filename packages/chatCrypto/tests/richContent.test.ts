import { describe, expect, it } from "vitest";

import { ChatControlLedger, ChatCryptoClient, InMemoryKeyDirectory, MemoryKeyValueStore, createPollOptions, nextPollVote, sanitizeControl, sanitizePoll } from "../src";
import { seededRandom } from "./testRandom";

const group = "0190f0a0-0000-7000-8000-00000000c001";
const direct = "0190f0a0-0000-7000-8000-00000000c002";

function createWorld() {
  const directory = new InMemoryKeyDirectory();
  let sequence = 0;
  const device = async (userId: string, seed: string) => {
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), random: seededRandom(seed) });
    await client.ensureReady(userId);
    return { userId, client };
  };
  const nextId = () => `m-${String(++sequence).padStart(4, "0")}`;
  return { device, nextId };
}

describe("encrypted locations, polls and controls", () => {
  it("carries a location and a poll only inside the ciphertext", async () => {
    const world = createWorld();
    const ada = await world.device("ada", "rich-ada");
    const bola = await world.device("bola", "rich-bola");
    const poll = { question: "Which fabric?", allowMultipleAnswers: false, options: createPollOptions(["Ankara", "Aso oke"], seededRandom("opts")) };
    const sentPoll = await ada.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bola"] }, { text: "", poll });
    const sentLocation = await ada.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bola"] }, { text: "", location: { latitude: 6.5244, longitude: 3.3792, label: "Balogun Market", liveUntil: null } });
    for (const sent of [sentPoll, sentLocation]) {
      expect(sent.encryption.ciphertext).not.toContain("Ankara");
      expect(sent.encryption.ciphertext).not.toContain("Balogun");
      expect(sent.encryption.ciphertext).not.toContain("6.5244");
    }
    const pollResult = await bola.client.decryptMessage({ id: world.nextId(), conversationId: direct, senderId: "ada", encryption: sentPoll.encryption });
    const locationResult = await bola.client.decryptMessage({ id: world.nextId(), conversationId: direct, senderId: "ada", encryption: sentLocation.encryption });
    expect(pollResult.status === "decrypted" ? pollResult.payload.poll?.options.map((option) => option.text) : pollResult).toEqual(["Ankara", "Aso oke"]);
    expect(locationResult.status === "decrypted" ? locationResult.payload.location : locationResult).toEqual({ latitude: 6.5244, longitude: 3.3792, label: "Balogun Market" });
  });

  it("rejects malformed polls and controls", () => {
    expect(sanitizePoll({ question: "Q", options: [{ id: "a", text: "Same" }, { id: "b", text: "same" }] })).toBeNull();
    expect(sanitizePoll({ question: "Q", options: [{ id: "a", text: "Only" }] })).toBeNull();
    expect(sanitizeControl({ type: "reaction", targetMessageId: "m1", emoji: "" })).toBeNull();
    expect(sanitizeControl({ type: "locationUpdate", targetMessageId: "m1", latitude: 91, longitude: 0 })).toBeNull();
    expect(sanitizeControl({ type: "unknown", targetMessageId: "m1" })).toBeNull();
  });

  it("tallies reactions, votes and live location updates from control messages", () => {
    const poll = { question: "Q", allowMultipleAnswers: false, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] };
    const ledger = ChatControlLedger.from([
      { id: "c1", senderId: "ada", createdAt: "2026-10-10T10:00:00Z", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } },
      { id: "c2", senderId: "bola", createdAt: "2026-10-10T10:00:01Z", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } },
      { id: "c3", senderId: "ada", createdAt: "2026-10-10T10:00:02Z", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: true } },
      { id: "c4", senderId: "ada", createdAt: "2026-10-10T10:00:03Z", control: { type: "pollVote", targetMessageId: "p1", optionIds: ["a", "b"] } },
      { id: "c5", senderId: "bola", createdAt: "2026-10-10T10:00:04Z", control: { type: "pollVote", targetMessageId: "p1", optionIds: ["zzz"] } },
      { id: "c6", senderId: "mallory", createdAt: "2026-10-10T10:00:05Z", control: { type: "locationUpdate", targetMessageId: "l1", latitude: 1, longitude: 1, label: null } },
      { id: "c7", senderId: "ada", createdAt: "2026-10-10T10:00:06Z", control: { type: "locationUpdate", targetMessageId: "l1", latitude: 6.6, longitude: 3.4, label: "Ikeja" } },
    ]);
    ledger.apply([{ id: "c1", senderId: "ada", createdAt: "2026-10-10T10:00:00Z", control: { type: "reaction", targetMessageId: "m1", emoji: "🔥", remove: false } }]);
    expect(ledger.reactions("m1", "ada")).toEqual([{ emoji: "🔥", count: 1, reactedByMe: false, userIds: ["bola"] }]);
    expect(ledger.poll("p1", poll, "ada")).toEqual([{ id: "a", text: "A", voteCount: 1, votedByMe: true }, { id: "b", text: "B", voteCount: 0, votedByMe: false }]);
    const live = ledger.liveLocation("l1", "ada", { latitude: 6.5, longitude: 3.3, label: "Start", liveUntil: "2026-10-10T18:00:00Z" }, "2026-10-10T09:00:00Z", new Date("2026-10-10T11:00:00Z"));
    expect(live).toMatchObject({ latitude: 6.6, longitude: 3.4, label: "Ikeja", stopped: false });
    ledger.apply([{ id: "c8", senderId: "mallory", control: { type: "locationStop", targetMessageId: "l1" } }]);
    expect(ledger.liveLocation("l1", "ada", { latitude: 6.5, longitude: 3.3, label: null, liveUntil: "2026-10-10T18:00:00Z" }, null, new Date("2026-10-10T11:00:00Z")).stopped).toBe(false);
    ledger.apply([{ id: "c9", senderId: "ada", control: { type: "locationStop", targetMessageId: "l1" } }]);
    expect(ledger.liveLocation("l1", "ada", { latitude: 6.5, longitude: 3.3, label: null, liveUntil: "2026-10-10T18:00:00Z" }, null, new Date("2026-10-10T11:00:00Z")).stopped).toBe(true);
    expect(nextPollVote(["a"], "b", false)).toEqual(["b"]);
    expect(nextPollVote(["a"], "a", true)).toEqual([]);
  });
});

describe("encrypted group attributes", () => {
  it("shares the group key inside group messages so only members can read the name", async () => {
    const world = createWorld();
    const owner = await world.device("owner", "ga-owner");
    const member = await world.device("member", "ga-member");
    const outsider = await world.device("outsider", "ga-outsider");
    const prepared = owner.client.prepareNewGroup({ title: "Lagos fabric crew", description: "Weekend market runs", avatar: null });
    expect(prepared.encryptedAttributes).not.toContain("Lagos");
    await owner.client.rememberGroupKey(group, prepared.groupKey);
    expect(await member.client.openGroupAttributes(group, prepared.encryptedAttributes)).toBeNull();
    const sent = await owner.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: ["owner", "member"] }, { text: "", control: { type: "groupUpdate" } });
    const result = await member.client.decryptMessage({ id: world.nextId(), conversationId: group, senderId: "owner", encryption: sent.encryption });
    expect(result.status === "decrypted" ? result.payload.control : result).toEqual({ type: "groupUpdate" });
    expect(await member.client.openGroupAttributes(group, prepared.encryptedAttributes)).toEqual({ title: "Lagos fabric crew", description: "Weekend market runs", avatar: null });
    expect(await outsider.client.openGroupAttributes(group, prepared.encryptedAttributes)).toBeNull();
    const rotated = await owner.client.sealGroupAttributes(group, { title: "Renamed", description: null, avatar: null }, { rotate: true });
    expect(await member.client.openGroupAttributes(group, rotated)).toBeNull();
    const next = await owner.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: ["owner", "member"] }, { text: "", control: { type: "groupUpdate" } });
    await member.client.decryptMessage({ id: world.nextId(), conversationId: group, senderId: "owner", encryption: next.encryption });
    expect((await member.client.openGroupAttributes(group, rotated))?.title).toBe("Renamed");
  });
});

describe("store team chats", () => {
  it("rotates the sender key when a team member is removed and gives new members no history", async () => {
    const world = createWorld();
    const store = "0190f0a0-0000-7000-8000-00000000c003";
    const buyer = await world.device("buyer", "store-buyer");
    const tolu = await world.device("tolu", "store-tolu");
    const leaver = await world.device("leaver", "store-leaver");
    const first = await buyer.client.encryptMessage({ kind: "group", conversationId: store, memberUserIds: ["buyer", "tolu", "leaver"] }, { text: "Is the Ankara in stock?" });
    await first.confirmSent("s-1");
    const firstMessage = { id: "s-1", conversationId: store, senderId: "buyer", encryption: first.encryption };
    for (const member of [tolu, leaver]) expect((await member.client.decryptMessage(firstMessage)).status).toBe("decrypted");
    const newcomer = await world.device("newcomer", "store-newcomer");
    const second = await buyer.client.encryptMessage({ kind: "group", conversationId: store, memberUserIds: ["buyer", "tolu", "newcomer"] }, { text: "My address is 12 Allen Avenue" });
    await second.confirmSent("s-2");
    const secondMessage = { id: "s-2", conversationId: store, senderId: "buyer", encryption: second.encryption };
    expect((await tolu.client.decryptMessage(secondMessage)).status).toBe("decrypted");
    expect((await newcomer.client.decryptMessage(secondMessage)).status).toBe("decrypted");
    const leaverResult = await leaver.client.decryptMessage(secondMessage);
    expect(leaverResult.status).toBe("failed");
    expect((await newcomer.client.decryptMessage(firstMessage)).status).toBe("failed");
  });
});
