import { type Bytes, concatBytes } from "./bytes.util";
import { ChatCryptoError } from "./errors";
import { type DeviceIdentity, verifySignedPreKey } from "./keys";
import { type KeyPair, type RandomSource, agree, deriveKey, generateAgreementKeyPair, signingToAgreementPublicKey, signingToAgreementSecretKey, zeroSalt } from "./primitives";

export interface PreKeyBundleKeys {
  readonly identityKey: Bytes;
  readonly signedPreKeyId: number;
  readonly signedPreKey: Bytes;
  readonly signedPreKeySignature: Bytes;
  readonly oneTimePreKeyId: number | null;
  readonly oneTimePreKey: Bytes | null;
}

export interface X3dhResult {
  readonly sharedSecret: Bytes;
  readonly associatedData: Bytes;
}

export interface X3dhInitiation extends X3dhResult {
  readonly baseKey: KeyPair;
}

const x3dhInfo = "ZudomartX3DHv1";
const domainSeparator = new Uint8Array(32).fill(0xff);

const deriveSharedSecret = (agreements: readonly Bytes[]) => deriveKey(concatBytes(domainSeparator, ...agreements), zeroSalt, x3dhInfo, 32);

export function initiateX3dh(local: DeviceIdentity, bundle: PreKeyBundleKeys, random: RandomSource): X3dhInitiation {
  if (!verifySignedPreKey(bundle.identityKey, bundle.signedPreKeyId, bundle.signedPreKey, bundle.signedPreKeySignature)) {
    throw new ChatCryptoError("INVALID_SIGNATURE", "The signed prekey signature is invalid.");
  }
  const baseKey = generateAgreementKeyPair(random);
  const localIdentitySecret = signingToAgreementSecretKey(local.signing.secretKey);
  const agreements = [
    agree(localIdentitySecret, bundle.signedPreKey),
    agree(baseKey.secretKey, signingToAgreementPublicKey(bundle.identityKey)),
    agree(baseKey.secretKey, bundle.signedPreKey),
    ...(bundle.oneTimePreKey === null ? [] : [agree(baseKey.secretKey, bundle.oneTimePreKey)]),
  ];
  return { baseKey, sharedSecret: deriveSharedSecret(agreements), associatedData: concatBytes(local.signing.publicKey, bundle.identityKey) };
}

export function respondX3dh(local: DeviceIdentity, signedPreKey: KeyPair, oneTimePreKey: KeyPair | null, remoteIdentityKey: Bytes, baseKey: Bytes): X3dhResult {
  const agreements = [
    agree(signedPreKey.secretKey, signingToAgreementPublicKey(remoteIdentityKey)),
    agree(signingToAgreementSecretKey(local.signing.secretKey), baseKey),
    agree(signedPreKey.secretKey, baseKey),
    ...(oneTimePreKey === null ? [] : [agree(oneTimePreKey.secretKey, baseKey)]),
  ];
  return { sharedSecret: deriveSharedSecret(agreements), associatedData: concatBytes(remoteIdentityKey, local.signing.publicKey) };
}
