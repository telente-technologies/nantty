import { describe, expect, it } from "vitest";

import { ChatCryptoClient, type CrossContextLock, InMemoryKeyDirectory, MemoryKeyValueStore, createWebLocksMutex } from "../src";
import { seededRandom } from "./testRandom";

const group = "0190f0a0-0000-7000-8000-00000000a0c1";

function sharedMutex(): CrossContextLock {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>) => {
    const run = tail.then(task, task);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

function twoTabs(lock: CrossContextLock | undefined) {
  const directory = new InMemoryKeyDirectory();
  const storage = { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() };
  const tab = (seed: string) => new ChatCryptoClient({ storage, directory: directory.forUser("alice"), random: seededRandom(seed), ...(lock === undefined ? {} : { lock }) });
  return { directory, tabs: [tab("tab-a"), tab("tab-b")] as const };
}

describe("several tabs sharing one key store", () => {
  it("registers a single device when two tabs start secure chat at the same time", async () => {
    const { directory, tabs } = twoTabs(sharedMutex());
    const [first, second] = await Promise.all(tabs.map((tab) => tab.ensureReady("alice")));
    expect(first?.deviceId).toBe(second?.deviceId);
    expect((await directory.forUser("bob").listDevices(["alice"]))[0]?.devices).toHaveLength(1);
  });

  it("never encrypts two different messages with the same sender-key step from two tabs", async () => {
    const { directory, tabs } = twoTabs(sharedMutex());
    const bob = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser("bob"), random: seededRandom("bob") });
    await bob.ensureReady("bob");
    await tabs[0].ensureReady("alice");
    await tabs[1].ensureReady("alice");
    const target = { kind: "group" as const, conversationId: group, memberUserIds: ["bob"] };
    const [one, two] = await Promise.all([tabs[0].encryptMessage(target, { text: "from tab a" }), tabs[1].encryptMessage(target, { text: "from tab b" })]);
    await one.confirmSent("m-1");
    await two.confirmSent("m-2");
    const results = await bob.decryptMessages([
      { id: "m-1", conversationId: group, senderId: "alice", createdAt: "2026-10-11T10:00:00.000Z", encryption: one.encryption },
      { id: "m-2", conversationId: group, senderId: "alice", createdAt: "2026-10-11T10:00:01.000Z", encryption: two.encryption },
    ]);
    const texts = [...results.values()].map((result) => (result.status === "decrypted" ? result.payload.text : result.status));
    expect(texts).toEqual(["from tab a", "from tab b"]);
  });

  it("picks up the identity another tab re-registered instead of keeping a stale one in memory", async () => {
    const { tabs } = twoTabs(sharedMutex());
    const original = await tabs[0].ensureReady("alice");
    await tabs[1].signOut({ removeFromDirectory: true });
    const replacement = await tabs[1].ensureReady("alice");
    expect(replacement.deviceId).not.toBe(original.deviceId);
    expect((await tabs[0].ensureReady("alice")).deviceId).toBe(replacement.deviceId);
  });

  it("uses the Web Locks API when the platform has it and stays optional elsewhere", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const requested: string[] = [];
    try {
      Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
      expect(createWebLocksMutex("nantty-test")).toBeUndefined();
      const navigatorLike = { locks: { request: (name: string, _options: unknown, callback: () => Promise<unknown>) => (requested.push(name), callback()) } };
      Object.defineProperty(globalThis, "navigator", { value: navigatorLike, configurable: true });
      const lock = createWebLocksMutex("nantty-test");
      expect(await lock?.(async () => 7)).toBe(7);
      expect(requested).toEqual(["nantty-test"]);
    } finally {
      if (original === undefined) Reflect.deleteProperty(globalThis, "navigator");
      else Object.defineProperty(globalThis, "navigator", original);
    }
  });
});
