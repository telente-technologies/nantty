import { createPublicKey, verify } from "node:crypto";

import { unprocessable } from "../../../errors/social.error.js";
import type { WireSignedPreKey } from "../models/messagingKeys.model.js";

const signedPreKeyLabel = Buffer.from("zudomart-signed-prekey-v1", "utf8");

function decodeKey(value: string, length: number): Buffer | null {
  const bytes = Buffer.from(value, "base64");
  return bytes.length === length && bytes.toString("base64") === value ? bytes : null;
}

export function isValidSignedPreKey(identityKey: string, signedPreKey: WireSignedPreKey): boolean {
  const identity = decodeKey(identityKey, 32);
  const publicKey = decodeKey(signedPreKey.publicKey, 32);
  const signature = decodeKey(signedPreKey.signature, 64);
  if (identity === null || publicKey === null || signature === null) return false;
  const keyId = Buffer.alloc(4);
  keyId.writeUInt32BE(signedPreKey.keyId);
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: identity.toString("base64url") }, format: "jwk" });
    return verify(null, Buffer.concat([signedPreKeyLabel, keyId, publicKey]), key, signature);
  } catch {
    return false;
  }
}

export function requireValidSignedPreKey(identityKey: string, signedPreKey: WireSignedPreKey): void {
  if (!isValidSignedPreKey(identityKey, signedPreKey)) throw unprocessable("SIGNED_PREKEY_INVALID", "The signed prekey signature does not verify against the identity key.");
}

export const isValidAgreementKey = (value: string): boolean => decodeKey(value, 32) !== null;
