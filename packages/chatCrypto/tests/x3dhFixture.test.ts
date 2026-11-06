import { describe, expect, it } from "vitest";

import fixture from "../fixtures/x3dh-v1.json";
import { createDeviceIdentity, createOneTimePreKeys, createSignedPreKey } from "../src/keys";
import { initiateX3dh, respondX3dh } from "../src/x3dh";
import { hex, seededRandom } from "./testRandom";

describe("shared X3DH v1 fixture", () => {
  it("reproduces the RN initiator and responder values for Kotlin interoperability", () => {
    const alice = createDeviceIdentity("alice", seededRandom(fixture.initiatorSeed));
    const bob = createDeviceIdentity("bob", seededRandom(fixture.responderSeed));
    const signedPreKey = createSignedPreKey(bob, fixture.signedPreKeyId, seededRandom(fixture.signedPreKeySeed), 0);
    const oneTimePreKey = createOneTimePreKeys(fixture.oneTimePreKeyId, 1, seededRandom(fixture.oneTimePreKeySeed))[0]!;
    const initiation = initiateX3dh(alice, {
      identityKey: bob.signing.publicKey,
      signedPreKeyId: signedPreKey.keyId,
      signedPreKey: signedPreKey.keyPair.publicKey,
      signedPreKeySignature: signedPreKey.signature,
      oneTimePreKeyId: oneTimePreKey.keyId,
      oneTimePreKey: oneTimePreKey.keyPair.publicKey,
    }, seededRandom(fixture.baseKeySeed));
    const response = respondX3dh(bob, signedPreKey.keyPair, oneTimePreKey.keyPair, alice.signing.publicKey, initiation.baseKey.publicKey);

    expect(hex(alice.signing.publicKey)).toBe(fixture.aliceIdentityPublic);
    expect(hex(bob.signing.publicKey)).toBe(fixture.bobIdentityPublic);
    expect(hex(signedPreKey.keyPair.publicKey)).toBe(fixture.signedPreKeyPublic);
    expect(hex(signedPreKey.signature)).toBe(fixture.signedPreKeySignature);
    expect(hex(oneTimePreKey.keyPair.publicKey)).toBe(fixture.oneTimePreKeyPublic);
    expect(hex(initiation.baseKey.publicKey)).toBe(fixture.baseKeyPublic);
    expect(hex(initiation.sharedSecret)).toBe(fixture.sharedSecret);
    expect(hex(response.sharedSecret)).toBe(fixture.sharedSecret);
    expect(hex(initiation.associatedData)).toBe(fixture.associatedData);
    expect(hex(response.associatedData)).toBe(fixture.associatedData);
  });
});
