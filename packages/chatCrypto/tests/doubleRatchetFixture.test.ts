import { describe, expect, it } from "vitest";

import fixture from "../fixtures/double-ratchet-v1.json";
import { encodeHeader } from "../src/doubleRatchet";
import { initializeInitiator, ratchetEncrypt } from "../src/doubleRatchet";
import { generateAgreementKeyPair } from "../src/primitives";
import { fromHex, hex, seededRandom } from "./testRandom";

describe("Double Ratchet Kotlin interoperability vector", () => {
  it("matches the deterministic shared vector used by Kotlin", () => {
    const remote = {
      secretKey: fromHex(fixture.remoteSignedPreKeyPrivate),
      publicKey: generateAgreementKeyPair(seededRandom("double-ratchet-remote-spk")).publicKey,
    };
    const baseKey = generateAgreementKeyPair(seededRandom("double-ratchet-base-key"));
    const state = initializeInitiator(
      {
        sharedSecret: fromHex(fixture.sharedSecret),
        associatedData: fromHex(fixture.associatedData),
        baseKey: { ...baseKey, publicKey: fromHex(fixture.baseKeyPublic) },
      },
      remote.publicKey,
      fromHex(fixture.remoteIdentityKey),
      { signedPreKeyId: 17, oneTimePreKeyId: 23 },
      () => fromHex(fixture.sendingRatchetPrivate),
    );
    const result = ratchetEncrypt(state, fromHex(fixture.plaintext));

    expect(hex(encodeHeader(result.header))).toBe(fixture.header);
    expect(hex(result.ciphertext)).toBe(fixture.ciphertext);
    expect(hex(result.state.sendingChain!.key)).toBe(fixture.nextSendingChainKey);
  });
});
