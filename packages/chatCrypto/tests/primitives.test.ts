import { describe, expect, it } from "vitest";

import { decodeBase64, encodeBase64, utf8Encode } from "../src/bytes.util";
import { agree, agreementPublicKeyOf, deriveKey, hmacSha256, openAead, sealAead, sign, signingToAgreementPublicKey, signingToAgreementSecretKey, verifySignature } from "../src/primitives";
import { createDeviceIdentity, createSignedPreKey, verifySignedPreKey } from "../src/keys";
import { fromHex, hex, seededRandom } from "./testRandom";

describe("primitive vectors", () => {
  it("matches the RFC 7748 X25519 vector", () => {
    const scalar = fromHex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4");
    const point = fromHex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c");
    expect(hex(agree(scalar, point))).toBe("c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552");
  });

  it("matches the RFC 8032 Ed25519 test 1 vector", () => {
    const secret = fromHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    const publicKey = fromHex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
    const signature = sign(secret, new Uint8Array());
    expect(hex(signature)).toBe("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b");
    expect(verifySignature(signature, new Uint8Array(), publicKey)).toBe(true);
    expect(verifySignature(signature, new Uint8Array([1]), publicKey)).toBe(false);
  });

  it("matches the RFC 5869 HKDF test 3 vector", () => {
    expect(hex(deriveKey(new Uint8Array(22).fill(0x0b), new Uint8Array(), "", 42))).toBe("8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8");
  });

  it("matches the RFC 4231 HMAC-SHA256 test 2 vector", () => {
    expect(hex(hmacSha256(utf8Encode("Jefe"), utf8Encode("what do ya want for nothing?")))).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("matches the GCM spec AES-256 test case 16 vector and rejects tampering", () => {
    const key = fromHex("feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308");
    const nonce = fromHex("cafebabefacedbaddecaf888");
    const associatedData = fromHex("feedfacedeadbeeffeedfacedeadbeefabaddad2");
    const plaintext = fromHex("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39");
    const sealed = sealAead(key, nonce, plaintext, associatedData);
    expect(hex(sealed)).toBe("522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662" + "76fc6ece0f4e1768cddf8853bb2d551b");
    expect(hex(openAead(key, nonce, sealed, associatedData))).toBe(hex(plaintext));
    const tampered = sealed.slice();
    tampered[0] = (tampered[0] as number) ^ 1;
    expect(() => openAead(key, nonce, tampered, associatedData)).toThrow();
    expect(() => openAead(key, nonce, sealed, new Uint8Array())).toThrow();
  });

  it("converts Ed25519 identities to X25519 consistently", () => {
    const random = seededRandom("conversion");
    const alice = createDeviceIdentity("alice", random);
    const bob = createDeviceIdentity("bob", random);
    expect(hex(signingToAgreementPublicKey(alice.signing.publicKey))).toBe(hex(agreementPublicKeyOf(signingToAgreementSecretKey(alice.signing.secretKey))));
    const left = agree(signingToAgreementSecretKey(alice.signing.secretKey), signingToAgreementPublicKey(bob.signing.publicKey));
    const right = agree(signingToAgreementSecretKey(bob.signing.secretKey), signingToAgreementPublicKey(alice.signing.publicKey));
    expect(hex(left)).toBe(hex(right));
  });

  it("rejects low-order X25519 points", () => {
    expect(() => agree(seededRandom("low").call(null, 32), new Uint8Array(32))).toThrow();
  });

  it("signs prekeys bound to their key id", () => {
    const random = seededRandom("spk");
    const identity = createDeviceIdentity("alice", random);
    const signedPreKey = createSignedPreKey(identity, 7, random, 0);
    expect(verifySignedPreKey(identity.signing.publicKey, 7, signedPreKey.keyPair.publicKey, signedPreKey.signature)).toBe(true);
    expect(verifySignedPreKey(identity.signing.publicKey, 8, signedPreKey.keyPair.publicKey, signedPreKey.signature)).toBe(false);
  });

  it("round-trips base64 and matches RFC 4648 vectors", () => {
    const vectors: [string, string][] = [["", ""], ["f", "Zg=="], ["fo", "Zm8="], ["foo", "Zm9v"], ["foob", "Zm9vYg=="], ["fooba", "Zm9vYmE="], ["foobar", "Zm9vYmFy"]];
    for (const [plain, encoded] of vectors) {
      expect(encodeBase64(utf8Encode(plain))).toBe(encoded);
      expect(new TextDecoder().decode(decodeBase64(encoded))).toBe(plain);
    }
    const random = seededRandom("base64");
    for (let length = 0; length < 70; length++) {
      const bytes = random(length);
      expect(hex(decodeBase64(encodeBase64(bytes)))).toBe(hex(bytes));
    }
    expect(() => decodeBase64("Zm9=v")).toThrow();
    expect(() => decodeBase64("Zm9")).toThrow();
  });
});
