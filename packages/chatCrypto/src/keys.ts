import { type Bytes, concatBytes, utf8Encode, writeUint32 } from "./bytes.util";
import { type KeyPair, type RandomSource, generateAgreementKeyPair, generateSigningKeyPair, sign, verifySignature } from "./primitives";

export interface DeviceIdentity {
  readonly userId: string;
  readonly deviceId: string;
  readonly registrationId: number;
  readonly signing: KeyPair;
}

export interface SignedPreKey {
  readonly keyId: number;
  readonly keyPair: KeyPair;
  readonly signature: Bytes;
  readonly createdAt: number;
}

export interface OneTimePreKey {
  readonly keyId: number;
  readonly keyPair: KeyPair;
}

export const maximumKeyId = 0x7fffffff;

const signedPreKeyMessage = (keyId: number, publicKey: Bytes) => concatBytes(utf8Encode("zudomart-signed-prekey-v1"), writeUint32(keyId), publicKey);

function randomUint31(random: RandomSource): number {
  const bytes = random(4);
  return ((((bytes[0] as number) << 24) >>> 0) + ((bytes[1] as number) << 16) + ((bytes[2] as number) << 8) + (bytes[3] as number)) & maximumKeyId;
}

function randomHex(random: RandomSource, length: number): string {
  return [...random(length)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDeviceIdentity(userId: string, random: RandomSource): DeviceIdentity {
  return { userId, deviceId: randomHex(random, 16), registrationId: (randomUint31(random) % 16_380) + 1, signing: generateSigningKeyPair(random) };
}

export function createSignedPreKey(identity: DeviceIdentity, keyId: number, random: RandomSource, now: number): SignedPreKey {
  const keyPair = generateAgreementKeyPair(random);
  return { keyId, keyPair, signature: sign(identity.signing.secretKey, signedPreKeyMessage(keyId, keyPair.publicKey)), createdAt: now };
}

export const verifySignedPreKey = (identityKey: Bytes, keyId: number, publicKey: Bytes, signature: Bytes): boolean =>
  verifySignature(signature, signedPreKeyMessage(keyId, publicKey), identityKey);

export function createOneTimePreKeys(firstKeyId: number, count: number, random: RandomSource): OneTimePreKey[] {
  return Array.from({ length: count }, (_, index) => ({ keyId: ((firstKeyId + index - 1) % maximumKeyId) + 1, keyPair: generateAgreementKeyPair(random) }));
}

export const nextRandomKeyId = (random: RandomSource): number => (randomUint31(random) % (maximumKeyId - 1)) + 1;
