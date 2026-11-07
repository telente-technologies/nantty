import { encodeBase64, utf8Encode } from "../src/bytes.util";
import type { PreKeyBundle } from "../src/directory";
import { createDeviceIdentity, createOneTimePreKeys, createSignedPreKey } from "../src/keys";
import { ProtocolStore } from "../src/protocolStore";
import { SessionCipher } from "../src/sessionCipher";
import { MemoryKeyValueStore, type KeyValueStore } from "../src/storage";
import { seededRandom } from "./testRandom";

export function createTestDevice(userId: string, seed: string, records: KeyValueStore = new MemoryKeyValueStore()) {
  const random = seededRandom(seed);
  const identity = createDeviceIdentity(userId, random);
  const store = new ProtocolStore({ secrets: new MemoryKeyValueStore(), records });
  const cipher = new SessionCipher(store, identity, random);
  return {
    identity, store, cipher, random,
    async publishBundle(withOneTimePreKey = true): Promise<PreKeyBundle> {
      const signedPreKey = createSignedPreKey(identity, 11, random, 0);
      await store.saveSignedPreKey(signedPreKey);
      const [oneTimePreKey] = createOneTimePreKeys(500, 1, random);
      if (oneTimePreKey !== undefined) await store.saveOneTimePreKey(oneTimePreKey);
      return {
        userId, deviceId: identity.deviceId, registrationId: identity.registrationId, identityKey: encodeBase64(identity.signing.publicKey),
        signedPreKey: { keyId: signedPreKey.keyId, publicKey: encodeBase64(signedPreKey.keyPair.publicKey), signature: encodeBase64(signedPreKey.signature) },
        oneTimePreKey: withOneTimePreKey && oneTimePreKey !== undefined ? { keyId: oneTimePreKey.keyId, publicKey: encodeBase64(oneTimePreKey.keyPair.publicKey) } : null,
      };
    },
  };
}

export type TestDevice = ReturnType<typeof createTestDevice>;

export const trustAll = async () => true;
export const text = (value: string) => utf8Encode(value);
export const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export async function connect(alice: TestDevice, bob: TestDevice, withOneTimePreKey = true) {
  await alice.cipher.initiateFromBundle(await bob.publishBundle(withOneTimePreKey));
}

export const send = (from: TestDevice, to: TestDevice, message: string) => from.cipher.encrypt(to.identity.userId, to.identity.deviceId, text(message));
export const receive = async (at: TestDevice, from: TestDevice, bytes: Uint8Array) => read(await at.cipher.decrypt(from.identity.userId, from.identity.deviceId, bytes, trustAll));
