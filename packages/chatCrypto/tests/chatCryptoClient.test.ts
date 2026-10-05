import { describe, expect, it } from "vitest";

import { ChatCryptoClient, type DecryptionResult, InMemoryKeyDirectory, MemoryKeyValueStore, type MessageEncryption } from "../src";
import { seededRandom } from "./testRandom";

const direct = "0190f0a0-0000-7000-8000-00000000d001";
const group = "0190f0a0-0000-7000-8000-00000000a001";

function createWorld() {
  const directory = new InMemoryKeyDirectory();
  let sequence = 0;
  const device = async (userId: string, seed: string) => {
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), random: seededRandom(seed) });
    await client.ensureReady(userId);
    return { userId, client };
  };
  const deliver = (senderId: string, conversationId: string, encryption: MessageEncryption) => ({ id: `m-${String(++sequence).padStart(4, "0")}`, conversationId, senderId, encryption });
  return { directory, device, deliver };
}

const textOf = (result: DecryptionResult) => (result.status === "decrypted" ? result.payload.text : `${result.status}:${"reason" in result ? result.reason : ""}`);

describe("ChatCryptoClient", () => {
  it("registers devices with signed prekeys and one-time prekeys", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c1");
    const status = world.directory.status("alice", alice.client.deviceId as string);
    expect(status?.oneTimePreKeyCount).toBe(100);
  });

  it("delivers direct messages to every device of both users", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c2a");
    const alicePhone = await world.device("alice", "c2b");
    const bob = await world.device("bob", "c2c");
    const bobLaptop = await world.device("bob", "c2d");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "hi bob", linkPreview: { url: "https://example.com", domain: "example.com", title: "Example", description: null, imageUrl: null } });
    expect(sent.linkPreview).toEqual(expect.any(String));
    expect(sent.encryption.ciphertext).not.toContain("example.com");
    const message = { ...world.deliver("alice", direct, sent.encryption), linkPreview: sent.linkPreview };
    await sent.confirmSent(message.id);
    const viaRealtime = await bobLaptop.client.decryptMessage({ ...message, linkPreview: undefined });
    expect(viaRealtime.status === "decrypted" && viaRealtime.payload.linkPreview).toBeNull();
    for (const reader of [bob, bobLaptop, alicePhone]) expect(textOf(await reader.client.decryptMessage(message))).toBe("hi bob");
    const read = await bob.client.decryptMessage(message);
    expect(read.status === "decrypted" && read.payload.linkPreview?.domain).toBe("example.com");
    const tampered = await bob.client.decryptMessage({ ...message, linkPreview: `${(sent.linkPreview as string).slice(0, -4)}AAA=` });
    expect(tampered.status === "decrypted" && tampered.payload.linkPreview).toBeNull();
    expect(textOf(await alice.client.decryptMessage(message))).toBe("hi bob");
    const reply = await bob.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["alice"] }, { text: "hello alice" });
    const replyMessage = world.deliver("bob", direct, reply.encryption);
    for (const reader of [alice, alicePhone, bobLaptop]) expect(textOf(await reader.client.decryptMessage(replyMessage))).toBe("hello alice");
  });

  it("refuses to send when the peer has no secure chat device", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c3");
    await expect(alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["carol"] }, { text: "hello?" })).rejects.toMatchObject({ code: "NO_RECIPIENT_DEVICES" });
  });

  it("rejects ciphertext moved into another conversation and replays under a new id", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c4a");
    const bob = await world.device("bob", "c4b");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "only here" });
    const moved = { ...world.deliver("alice", "0190f0a0-0000-7000-8000-00000000d999", sent.encryption) };
    expect(textOf(await bob.client.decryptMessage(moved))).toBe("failed:PAYLOAD_MISMATCH");
    const genuine = world.deliver("alice", direct, sent.encryption);
    expect(textOf(await bob.client.decryptMessage(genuine))).toBe("failed:DUPLICATE_MESSAGE");
  });

  it("caches plaintext so history reloads do not need the ratchet again", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c5a");
    const bob = await world.device("bob", "c5b");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "cached" });
    const message = world.deliver("alice", direct, sent.encryption);
    expect(textOf(await bob.client.decryptMessage(message))).toBe("cached");
    expect(textOf(await bob.client.decryptMessage(message))).toBe("cached");
    expect(textOf(await alice.client.decryptMessage(message))).toBe("failed:SENT_FROM_THIS_DEVICE");
    await sent.confirmSent(message.id);
    expect(textOf(await alice.client.decryptMessage(message))).toBe("cached");
  });

  it("uses sender keys in groups and rotates them when a member leaves", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c6a");
    const bob = await world.device("bob", "c6b");
    const carol = await world.device("carol", "c6c");
    const members = ["alice", "bob", "carol"];
    const first = await alice.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: members }, { text: "hello group" });
    const firstMessage = world.deliver("alice", group, first.encryption);
    await first.confirmSent(firstMessage.id);
    expect(JSON.parse(first.encryption.ciphertext).r).toHaveLength(2);
    const second = await alice.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: members }, { text: "second" });
    expect(JSON.parse(second.encryption.ciphertext).r).toHaveLength(0);
    const secondMessage = world.deliver("alice", group, second.encryption);
    await second.confirmSent(secondMessage.id);
    for (const reader of [bob, carol]) {
      expect(textOf(await reader.client.decryptMessage(secondMessage))).toBe("failed:NO_SENDER_KEY");
      expect(textOf(await reader.client.decryptMessage(firstMessage))).toBe("hello group");
      expect(textOf(await reader.client.decryptMessage(secondMessage))).toBe("second");
    }
    const afterLeave = await alice.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: ["alice", "bob"] }, { text: "carol left" });
    const leaveMessage = world.deliver("alice", group, afterLeave.encryption);
    expect(JSON.parse(afterLeave.encryption.ciphertext).r).toHaveLength(1);
    expect(textOf(await bob.client.decryptMessage(leaveMessage))).toBe("carol left");
    expect(textOf(await carol.client.decryptMessage(leaveMessage))).toBe("failed:NO_SENDER_KEY");
  });

  it("resends the sender key distribution when a send was never confirmed", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c7a");
    const bob = await world.device("bob", "c7b");
    await alice.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: ["alice", "bob"] }, { text: "lost" });
    const retry = await alice.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: ["alice", "bob"] }, { text: "retried" });
    expect(textOf(await bob.client.decryptMessage(world.deliver("alice", group, retry.encryption)))).toBe("retried");
  });

  it("flags a security code change when a contact reinstalls and keeps messaging working", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c8a");
    const bob = await world.device("bob", "c8b");
    const first = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "before" });
    expect(textOf(await bob.client.decryptMessage(world.deliver("alice", direct, first.encryption)))).toBe("before");
    expect(await alice.client.identityChanges(["bob"])).toEqual([]);
    await bob.client.signOut({ removeFromDirectory: true });
    const reinstalled = await world.device("bob", "c8c");
    await alice.client.resetSessions("bob");
    const after = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "after reinstall" });
    expect(textOf(await reinstalled.client.decryptMessage(world.deliver("alice", direct, after.encryption)))).toBe("after reinstall");
    expect(await alice.client.identityChanges(["bob"])).toEqual(["bob"]);
    await alice.client.acknowledgeIdentityChange("bob");
    expect(await alice.client.identityChanges(["bob"])).toEqual([]);
  });

  it("computes the same security code on both sides", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c9a");
    const bob = await world.device("bob", "c9b");
    const code = await alice.client.securityCode("bob");
    expect(code).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(await bob.client.securityCode("alice")).toBe(code);
  });

  it("does not decrypt messages sent before a device joined", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c10a");
    await world.device("bob", "c10b");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: direct, memberUserIds: ["bob"] }, { text: "early" });
    const laterDevice = await world.device("bob", "c10c");
    expect(textOf(await laterDevice.client.decryptMessage(world.deliver("alice", direct, sent.encryption)))).toBe("failed:NOT_FOR_THIS_DEVICE");
  });

  it("replenishes one-time prekeys when they run low", async () => {
    const world = createWorld();
    const storage = { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() };
    const bob = new ChatCryptoClient({ storage, directory: world.directory.forUser("bob"), random: seededRandom("c11b") });
    await bob.ensureReady("bob");
    const deviceId = bob.deviceId as string;
    world.directory.claim(Array.from({ length: 90 }, () => ({ userId: "bob", deviceId })));
    expect(world.directory.status("bob", deviceId)?.oneTimePreKeyCount).toBe(10);
    const later = new Date(Date.now() + 11 * 60_000);
    const restarted = new ChatCryptoClient({ storage, directory: world.directory.forUser("bob"), random: seededRandom("c11c"), now: () => later });
    await restarted.ensureReady("bob");
    expect(restarted.deviceId).toBe(deviceId);
    expect(world.directory.status("bob", deviceId)?.oneTimePreKeyCount).toBe(100);
  });

  it("encrypts story replies addressed to users before the conversation exists", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "c12a");
    const bob = await world.device("bob", "c12b");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: null, memberUserIds: ["bob"] }, { text: "nice story", storyId: "story-1" });
    const result = await bob.client.decryptMessage({ ...world.deliver("alice", direct, sent.encryption), sharedContent: { reference: { kind: "story", id: "story-1" } } });
    expect(result.status === "decrypted" && [result.payload.text, result.payload.storyId]).toEqual(["nice story", "story-1"]);
  });
});
