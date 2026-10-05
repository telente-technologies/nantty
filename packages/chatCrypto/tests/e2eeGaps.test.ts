import { describe, expect, it } from "vitest";

import { ChatCryptoClient, decryptAttachment, encryptAttachment, InMemoryKeyDirectory, MemoryKeyValueStore } from "../src";
import { seededRandom } from "./testRandom";

const group = "0190f0a0-0000-7000-8000-00000000b001";

function createWorld(now: () => Date = () => new Date()) {
  const directory = new InMemoryKeyDirectory();
  let sequence = 0;
  const device = async (userId: string, seed: string) => {
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser(userId), random: seededRandom(seed), now });
    await client.ensureReady(userId);
    return { userId, client };
  };
  const nextId = () => `m-${String(++sequence).padStart(4, "0")}`;
  return { directory, device, nextId };
}

describe("large groups", () => {
  it("moves sender-key distributions to the per-device mailbox and keeps the message small", async () => {
    const world = createWorld();
    const sender = await world.device("sender", "big-sender");
    const readers = [];
    for (let index = 0; index < 45; index++) {
      readers.push(await world.device(`member-${index}`, `big-${index}-a`));
      readers.push(await world.device(`member-${index}`, `big-${index}-b`));
    }
    const members = ["sender", ...Array.from({ length: 45 }, (_, index) => `member-${index}`)];
    const sent = await sender.client.encryptMessage({ kind: "group", conversationId: group, memberUserIds: members }, { text: "hello everyone" });
    const envelope = JSON.parse(sent.encryption.ciphertext) as { r: unknown[] };
    expect(envelope.r).toHaveLength(0);
    expect(sent.encryption.ciphertext.length).toBeLessThan(2_000);
    const message = { id: world.nextId(), conversationId: group, senderId: "sender", encryption: sent.encryption };
    for (const reader of readers) {
      const result = await reader.client.decryptMessage(message);
      expect(result.status === "decrypted" ? result.payload.text : result).toBe("hello everyone");
    }
    expect(world.directory.mailbox("member-0", readers[0]!.client.deviceId as string)).toHaveLength(0);
  }, 60_000);
});

describe("attachments", () => {
  it("encrypts with a random key, verifies the digest and rejects tampering", () => {
    const random = seededRandom("attachment");
    const plaintext = random(5000);
    const { blob, pointer, sha256Hex } = encryptAttachment(plaintext, { contentType: "image/jpeg", width: 10, height: 20, thumbnail: "AAAA" }, random);
    expect(sha256Hex).toMatch(/^[0-9a-f]{64}$/);
    expect([...decryptAttachment(blob, pointer)]).toEqual([...plaintext]);
    const tampered = blob.slice();
    tampered[40] = (tampered[40] as number) ^ 1;
    expect(() => decryptAttachment(tampered, pointer)).toThrow(/digest/);
    expect(() => decryptAttachment(blob, { ...pointer, key: pointer.digest })).toThrow(/authenticated/);
  });

  it("carries the attachment pointer inside the encrypted message", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "att-a");
    const bob = await world.device("bob", "att-b");
    const { pointer } = encryptAttachment(new Uint8Array([1, 2, 3]), { contentType: "application/pdf", fileName: "contract.pdf", pageCount: 2 }, seededRandom("att"));
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: group, memberUserIds: ["bob"] }, { text: "", attachment: pointer });
    expect(sent.encryption.ciphertext).not.toContain("contract.pdf");
    const result = await bob.client.decryptMessage({ id: world.nextId(), conversationId: group, senderId: "alice", encryption: sent.encryption });
    expect(result.status === "decrypted" && result.payload.attachment).toMatchObject(pointer);
  });
});

describe("server binding", () => {
  it("rejects a story reply whose server story reference does not match the encrypted one", async () => {
    const world = createWorld();
    const alice = await world.device("alice", "story-a");
    const bob = await world.device("bob", "story-b");
    const reply = async () => alice.client.encryptMessage({ kind: "direct", conversationId: null, memberUserIds: ["bob"] }, { text: "love it", storyId: "story-1", sharedContent: { kind: "story", id: "story-1" } });
    const genuine = await bob.client.decryptMessage({ id: world.nextId(), conversationId: group, senderId: "alice", encryption: (await reply()).encryption, sharedContent: { reference: { kind: "story", id: "story-1" } } });
    expect(genuine.status).toBe("decrypted");
    const swapped = await bob.client.decryptMessage({ id: world.nextId(), conversationId: group, senderId: "alice", encryption: (await reply()).encryption, sharedContent: { reference: { kind: "story", id: "story-2" } } });
    expect(swapped).toEqual({ status: "failed", reason: "PAYLOAD_MISMATCH" });
  });
});

describe("disappearing messages", () => {
  it("drops cached plaintext once the message expires", async () => {
    let clock = new Date("2026-10-05T10:00:00Z");
    const world = createWorld(() => clock);
    const alice = await world.device("alice", "exp-a");
    const bob = await world.device("bob", "exp-b");
    const sent = await alice.client.encryptMessage({ kind: "direct", conversationId: group, memberUserIds: ["bob"] }, { text: "gone soon" });
    const message = { id: world.nextId(), conversationId: group, senderId: "alice", encryption: sent.encryption, expiresAt: "2026-10-05T10:05:00.000Z" };
    expect((await bob.client.decryptMessage(message)).status).toBe("decrypted");
    await sent.confirmSent(message.id, message.expiresAt);
    clock = new Date("2026-10-05T10:06:00Z");
    expect(await bob.client.purgeExpiredPlaintext()).toBe(1);
    expect(await alice.client.purgeExpiredPlaintext()).toBe(1);
    expect((await alice.client.decryptMessage(message)).status).toBe("failed");
  });
});
