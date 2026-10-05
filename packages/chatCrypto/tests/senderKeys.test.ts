import { describe, expect, it } from "vitest";

import { utf8Encode } from "../src/bytes.util";
import { applyDistribution, createOwnSenderKey, decodeDistribution, encodeDistribution, groupDecrypt, groupEncrypt, type OwnSenderKey, type PeerSenderKeyRecord } from "../src/senderKeys";
import { seededRandom } from "./testRandom";

const conversationId = "0190f0a0-0000-7000-8000-000000000001";
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function setup() {
  let own: OwnSenderKey = createOwnSenderKey(seededRandom("sender"), 0);
  let record: PeerSenderKeyRecord | null = applyDistribution(null, decodeDistribution(encodeDistribution(conversationId, own)));
  return {
    send(message: string) {
      const result = groupEncrypt(own, conversationId, "alice", "deviceA", utf8Encode(message));
      own = result.own;
      return result.message;
    },
    receive(message: Uint8Array, target = conversationId) {
      const result = groupDecrypt(record, target, "alice", "deviceA", message);
      record = result.record;
      return read(result.plaintext);
    },
    get own() {
      return own;
    },
  };
}

const codeOf = (action: () => unknown) => {
  try {
    action();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
};

describe("sender keys", () => {
  it("encrypts group messages that members decrypt in and out of order", () => {
    const group = setup();
    const messages = ["one", "two", "three", "four"].map((text) => group.send(text));
    expect(group.receive(messages[2] as Uint8Array)).toBe("three");
    expect(group.receive(messages[0] as Uint8Array)).toBe("one");
    expect(group.receive(messages[3] as Uint8Array)).toBe("four");
    expect(group.receive(messages[1] as Uint8Array)).toBe("two");
  });

  it("rejects replays", () => {
    const group = setup();
    const message = group.send("once");
    group.receive(message);
    expect(codeOf(() => group.receive(message))).toBe("DUPLICATE_MESSAGE");
  });

  it("rejects messages moved to another conversation or forged by a member", () => {
    const group = setup();
    const message = group.send("bound");
    expect(codeOf(() => group.receive(message, "0190f0a0-0000-7000-8000-000000000002"))).toBe("INVALID_SIGNATURE");
    const forged = message.slice();
    forged[12] = (forged[12] as number) ^ 1;
    expect(codeOf(() => group.receive(forged))).toBe("INVALID_SIGNATURE");
    expect(group.receive(message)).toBe("bound");
  });

  it("needs the distribution before decrypting", () => {
    const own = createOwnSenderKey(seededRandom("other"), 0);
    const { message } = groupEncrypt(own, conversationId, "alice", "deviceA", utf8Encode("secret"));
    expect(codeOf(() => groupDecrypt(null, conversationId, "alice", "deviceA", message))).toBe("NO_SENDER_KEY");
  });

  it("starts a late member at the distributed iteration", () => {
    let own = createOwnSenderKey(seededRandom("late"), 0);
    for (let index = 0; index < 3; index++) own = groupEncrypt(own, conversationId, "alice", "deviceA", utf8Encode(`old ${index}`)).own;
    const record = applyDistribution(null, decodeDistribution(encodeDistribution(conversationId, own)));
    const { message } = groupEncrypt(own, conversationId, "alice", "deviceA", utf8Encode("new"));
    expect(read(groupDecrypt(record, conversationId, "alice", "deviceA", message).plaintext)).toBe("new");
  });
});
