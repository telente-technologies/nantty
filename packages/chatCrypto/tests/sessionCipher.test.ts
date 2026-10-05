import { describe, expect, it } from "vitest";

import { decodePairwiseMessage, encodePairwiseMessage } from "../src/wireMessage";
import { maximumSkippedPerChain } from "../src/doubleRatchet";
import { connect, createTestDevice, read, receive, send, text } from "./sessionHarness";
import { hex } from "./testRandom";

const codeOf = async (promise: Promise<unknown>) => promise.then(() => "ok", (error: { code?: string }) => error.code ?? "unknown");

describe("X3DH and Double Ratchet sessions", () => {
  it("runs a full conversation with ratchet turns", async () => {
    const alice = createTestDevice("alice", "a1");
    const bob = createTestDevice("bob", "b1");
    await connect(alice, bob);
    const first = await send(alice, bob, "hello bob");
    expect(decodePairwiseMessage(first).type).toBe("preKey");
    expect(await receive(bob, alice, first)).toBe("hello bob");
    const reply = await send(bob, alice, "hi alice");
    expect(decodePairwiseMessage(reply).type).toBe("message");
    expect(await receive(alice, bob, reply)).toBe("hi alice");
    const after = await send(alice, bob, "after reply");
    expect(decodePairwiseMessage(after).type).toBe("message");
    expect(await receive(bob, alice, after)).toBe("after reply");
    for (let round = 0; round < 5; round++) {
      expect(await receive(bob, alice, await send(alice, bob, `a${round}`))).toBe(`a${round}`);
      expect(await receive(alice, bob, await send(bob, alice, `b${round}`))).toBe(`b${round}`);
    }
  });

  it("keeps sending prekey messages until the peer replies", async () => {
    const alice = createTestDevice("alice", "a2");
    const bob = createTestDevice("bob", "b2");
    await connect(alice, bob);
    const first = await send(alice, bob, "one");
    const second = await send(alice, bob, "two");
    expect(decodePairwiseMessage(second).type).toBe("preKey");
    expect(await receive(bob, alice, second)).toBe("two");
    expect(await receive(bob, alice, first)).toBe("one");
  });

  it("decrypts out-of-order messages across ratchet steps using skipped keys", async () => {
    const alice = createTestDevice("alice", "a3");
    const bob = createTestDevice("bob", "b3");
    await connect(alice, bob);
    expect(await receive(bob, alice, await send(alice, bob, "start"))).toBe("start");
    expect(await receive(alice, bob, await send(bob, alice, "ack"))).toBe("ack");
    const chainOne = [await send(alice, bob, "1a"), await send(alice, bob, "1b"), await send(alice, bob, "1c")];
    expect(await receive(alice, bob, await send(bob, alice, "turn"))).toBe("turn");
    const chainTwo = [await send(alice, bob, "2a"), await send(alice, bob, "2b")];
    expect(await receive(bob, alice, chainTwo[1] as Uint8Array)).toBe("2b");
    expect(await receive(bob, alice, chainOne[2] as Uint8Array)).toBe("1c");
    expect(await receive(bob, alice, chainOne[0] as Uint8Array)).toBe("1a");
    expect(await receive(bob, alice, chainTwo[0] as Uint8Array)).toBe("2a");
    expect(await receive(bob, alice, chainOne[1] as Uint8Array)).toBe("1b");
  });

  it("rejects replays in the current chain, from skipped keys and from old chains", async () => {
    const alice = createTestDevice("alice", "a4");
    const bob = createTestDevice("bob", "b4");
    await connect(alice, bob);
    const first = await send(alice, bob, "first");
    await receive(bob, alice, first);
    expect(await codeOf(receive(bob, alice, first))).toBe("DUPLICATE_MESSAGE");
    const early = await send(alice, bob, "early");
    const late = await send(alice, bob, "late");
    await receive(bob, alice, late);
    await receive(bob, alice, early);
    expect(await codeOf(receive(bob, alice, early))).toBe("DUPLICATE_MESSAGE");
    expect(await codeOf(receive(bob, alice, late))).toBe("DUPLICATE_MESSAGE");
    await receive(alice, bob, await send(bob, alice, "turn"));
    await receive(bob, alice, await send(alice, bob, "new chain"));
    expect(await codeOf(receive(bob, alice, late))).toBe("DUPLICATE_MESSAGE");
  });

  it("rejects a replayed prekey message even without a one-time prekey", async () => {
    const alice = createTestDevice("alice", "a5");
    const bob = createTestDevice("bob", "b5");
    await connect(alice, bob, false);
    const first = await send(alice, bob, "no otp");
    expect(await receive(bob, alice, first)).toBe("no otp");
    await bob.store.saveSession("alice", alice.identity.deviceId, { current: null, archived: [], seenBaseKeys: (await bob.store.loadSession("alice", alice.identity.deviceId) as { seenBaseKeys?: string[] }).seenBaseKeys } as never);
    expect(await codeOf(receive(bob, alice, first))).toBe("DUPLICATE_MESSAGE");
  });

  it("rejects a prekey message whose one-time prekey was already consumed", async () => {
    const alice = createTestDevice("alice", "a6");
    const bob = createTestDevice("bob", "b6");
    await connect(alice, bob);
    const first = await send(alice, bob, "hello");
    await receive(bob, alice, first);
    await bob.store.deleteSession("alice", alice.identity.deviceId);
    expect(await codeOf(receive(bob, alice, first))).toBe("PREKEY_NOT_FOUND");
  });

  it("rejects tampered ciphertexts and headers without corrupting the session", async () => {
    const alice = createTestDevice("alice", "a7");
    const bob = createTestDevice("bob", "b7");
    await connect(alice, bob);
    await receive(bob, alice, await send(alice, bob, "setup"));
    const message = await send(alice, bob, "genuine");
    const tampered = message.slice();
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] as number) ^ 1;
    expect(await codeOf(receive(bob, alice, tampered))).toBe("INVALID_MESSAGE");
    const wire = decodePairwiseMessage(message);
    if (wire.type !== "message") throw new Error("expected a ratchet message");
    const forgedHeader = encodePairwiseMessage({ ...wire, header: { ...wire.header, index: wire.header.index + 1 } });
    expect(await codeOf(receive(bob, alice, forgedHeader))).toBe("INVALID_MESSAGE");
    expect(await receive(bob, alice, message)).toBe("genuine");
  });

  it("refuses to skip more than the maximum number of messages", async () => {
    const alice = createTestDevice("alice", "a8");
    const bob = createTestDevice("bob", "b8");
    await connect(alice, bob);
    await receive(bob, alice, await send(alice, bob, "setup"));
    const message = decodePairwiseMessage(await send(alice, bob, "far"));
    if (message.type !== "message") throw new Error("expected a ratchet message");
    const farAhead = encodePairwiseMessage({ ...message, header: { ...message.header, index: maximumSkippedPerChain + 5 } });
    expect(await codeOf(receive(bob, alice, farAhead))).toBe("TOO_MANY_SKIPPED");
  });

  it("rejects bundles with a bad signed prekey signature", async () => {
    const alice = createTestDevice("alice", "a9");
    const bob = createTestDevice("bob", "b9");
    const bundle = await bob.publishBundle();
    const forged = { ...bundle, signedPreKey: { ...bundle.signedPreKey, keyId: bundle.signedPreKey.keyId + 1 } };
    expect(await codeOf(alice.cipher.initiateFromBundle(forged))).toBe("INVALID_SIGNATURE");
  });

  it("rejects untrusted identities on prekey messages", async () => {
    const alice = createTestDevice("alice", "a10");
    const bob = createTestDevice("bob", "b10");
    await connect(alice, bob);
    const first = await send(alice, bob, "hello");
    expect(await codeOf(bob.cipher.decrypt("alice", alice.identity.deviceId, first, async () => false))).toBe("UNTRUSTED_IDENTITY");
  });

  it("recovers after a session reset with a fresh X3DH while old messages still decrypt", async () => {
    const alice = createTestDevice("alice", "a11");
    const bob = createTestDevice("bob", "b11");
    await connect(alice, bob);
    await receive(bob, alice, await send(alice, bob, "before"));
    await receive(alice, bob, await send(bob, alice, "ack"));
    const inFlight = await send(alice, bob, "in flight");
    await alice.cipher.reset("bob", bob.identity.deviceId);
    await connect(alice, bob);
    const fresh = await send(alice, bob, "after reset");
    expect(decodePairwiseMessage(fresh).type).toBe("preKey");
    expect(await receive(bob, alice, fresh)).toBe("after reset");
    expect(await receive(bob, alice, inFlight)).toBe("in flight");
    expect(await receive(alice, bob, await send(bob, alice, "reply after reset"))).toBe("reply after reset");
  });

  it("produces a stable protocol vector from a seeded random source", async () => {
    const alice = createTestDevice("alice", "vector-a");
    const bob = createTestDevice("bob", "vector-b");
    await connect(alice, bob);
    const first = await send(alice, bob, "vector");
    expect(read(await bob.cipher.decrypt("alice", alice.identity.deviceId, first, async () => true))).toBe("vector");
    expect(hex(first)).toMatchSnapshot();
    expect(hex(text("x"))).toBe("78");
  });
});
