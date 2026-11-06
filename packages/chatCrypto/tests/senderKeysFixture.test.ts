import { describe, expect, it } from "vitest";

import fixture from "../fixtures/sender-keys-v1.json";
import { utf8Decode, utf8Encode } from "../src/bytes.util";
import { applyDistribution, createOwnSenderKey, decodeDistribution, encodeDistribution, groupDecrypt, groupEncrypt } from "../src/senderKeys";
import { fromHex, hex, seededRandom } from "./testRandom";

describe("shared sender-key cross-client fixture", () => {
  it("matches deterministic creation, distribution encoding, and group-message bytes", () => {
    let own = createOwnSenderKey(seededRandom(fixture.seed), fixture.createdAt);
    expect(hex(encodeDistribution(fixture.conversationId, own))).toBe(fixture.distributionHex);

    const distribution = decodeDistribution(fromHex(fixture.distributionHex));
    expect(distribution.conversationId).toBe(fixture.conversationId);
    expect(distribution.keyId).toBe(own.keyId);
    expect(distribution.iteration).toBe(0);
    let peer = applyDistribution(null, distribution);

    for (const expected of fixture.messages) {
      const encrypted = groupEncrypt(own, fixture.conversationId, fixture.senderUserId, fixture.senderDeviceId, utf8Encode(expected.plaintext));
      own = encrypted.own;
      expect(hex(encrypted.message)).toBe(expected.messageHex);
      const decrypted = groupDecrypt(peer, fixture.conversationId, fixture.senderUserId, fixture.senderDeviceId, fromHex(expected.messageHex));
      peer = decrypted.record;
      expect(utf8Decode(decrypted.plaintext)).toBe(expected.plaintext);
    }
  });
});
