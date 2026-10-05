import { gcm } from "@noble/ciphers/aes.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

import { type Bytes, utf8Encode } from "./bytes.util";

export type RandomSource = (length: number) => Bytes;

export interface KeyPair {
  readonly publicKey: Bytes;
  readonly secretKey: Bytes;
}

export const defaultRandomSource: RandomSource = (length) => {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues === undefined) throw new Error("No secure random source is available.");
  return cryptoApi.getRandomValues(new Uint8Array(length));
};

export function generateAgreementKeyPair(random: RandomSource): KeyPair {
  const secretKey = random(32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) as Bytes };
}

export function generateSigningKeyPair(random: RandomSource): KeyPair {
  const secretKey = random(32);
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) as Bytes };
}

export const agreementPublicKeyOf = (secretKey: Bytes): Bytes => x25519.getPublicKey(secretKey) as Bytes;
export const agree = (secretKey: Bytes, publicKey: Bytes): Bytes => x25519.getSharedSecret(secretKey, publicKey) as Bytes;
export const signingToAgreementPublicKey = (publicKey: Bytes): Bytes => ed25519.utils.toMontgomery(publicKey) as Bytes;
export const signingToAgreementSecretKey = (secretKey: Bytes): Bytes => ed25519.utils.toMontgomerySecret(secretKey) as Bytes;
export const sign = (secretKey: Bytes, message: Bytes): Bytes => ed25519.sign(message, secretKey) as Bytes;

export function verifySignature(signature: Bytes, message: Bytes, publicKey: Bytes): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

export const deriveKey = (inputKeyMaterial: Bytes, salt: Bytes, info: string, length: number): Bytes =>
  hkdf(sha256, inputKeyMaterial, salt, utf8Encode(info), length) as Bytes;
export const hmacSha256 = (key: Bytes, data: Bytes): Bytes => hmac(sha256, key, data) as Bytes;
export const sha256Digest = (data: Bytes): Bytes => sha256(data) as Bytes;
export const sha512Digest = (data: Bytes): Bytes => sha512(data) as Bytes;

export const sealAead = (key: Bytes, nonce: Bytes, plaintext: Bytes, associatedData: Bytes): Bytes => gcm(key, nonce, associatedData).encrypt(plaintext) as Bytes;
export const openAead = (key: Bytes, nonce: Bytes, ciphertext: Bytes, associatedData: Bytes): Bytes => gcm(key, nonce, associatedData).decrypt(ciphertext) as Bytes;

export const aeadKeyLength = 32;
export const aeadNonceLength = 12;
export const zeroSalt = new Uint8Array(32);
