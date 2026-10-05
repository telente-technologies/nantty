import { type Bytes, ByteReader, concatBytes, utf8Decode, utf8Encode, writeUint32 } from "./bytes.util";
import { ChatCryptoError } from "./errors";
import { nextRandomKeyId } from "./keys";
import { type KeyPair, type RandomSource, deriveKey, generateSigningKeyPair, hmacSha256, openAead, sealAead, sign, verifySignature, zeroSalt } from "./primitives";

export interface OwnSenderKey {
  readonly keyId: number;
  readonly chainKey: Bytes;
  readonly iteration: number;
  readonly signing: KeyPair;
  readonly distributedTo: readonly string[];
  readonly createdAt: number;
}

export interface PeerSenderKeyState {
  readonly keyId: number;
  readonly chainKey: Bytes;
  readonly iteration: number;
  readonly signingPublicKey: Bytes;
  readonly skipped: readonly { readonly iteration: number; readonly messageKey: Bytes }[];
}

export interface PeerSenderKeyRecord {
  readonly states: readonly PeerSenderKeyState[];
}

export interface SenderKeyDistribution {
  readonly conversationId: string;
  readonly keyId: number;
  readonly iteration: number;
  readonly chainKey: Bytes;
  readonly signingPublicKey: Bytes;
}

const distributionVersion = 0x41;
const groupMessageVersion = 0x51;
const signatureLength = 64;
const maximumSenderKeySkip = 2000;
const maximumSenderKeyStates = 4;

const chainStep = (chainKey: Bytes): [Bytes, Bytes] => [hmacSha256(chainKey, new Uint8Array([1])), hmacSha256(chainKey, new Uint8Array([2]))];
const groupAssociatedData = (conversationId: string, senderUserId: string, senderDeviceId: string) => utf8Encode(`zudomart-group-v1|${conversationId}|${senderUserId}|${senderDeviceId}`);

function groupMessageKeys(messageKey: Bytes) {
  const material = deriveKey(messageKey, zeroSalt, "ZudomartSenderKeyv1", 44);
  return { key: material.slice(0, 32), nonce: material.slice(32) };
}

export function createOwnSenderKey(random: RandomSource, now: number): OwnSenderKey {
  return { keyId: nextRandomKeyId(random), chainKey: random(32), iteration: 0, signing: generateSigningKeyPair(random), distributedTo: [], createdAt: now };
}

export const encodeDistribution = (conversationId: string, key: OwnSenderKey): Bytes =>
  concatBytes(new Uint8Array([distributionVersion]), writeUint32(key.keyId), writeUint32(key.iteration), key.chainKey, key.signing.publicKey, utf8Encode(conversationId));

export function decodeDistribution(bytes: Bytes): SenderKeyDistribution {
  try {
    const reader = new ByteReader(bytes);
    if (reader.uint8() !== distributionVersion) throw new Error("version");
    return { keyId: reader.uint32(), iteration: reader.uint32(), chainKey: reader.take(32), signingPublicKey: reader.take(32), conversationId: utf8Decode(reader.rest()) };
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The sender key distribution is malformed.");
  }
}

export function applyDistribution(record: PeerSenderKeyRecord | null, distribution: SenderKeyDistribution): PeerSenderKeyRecord {
  const states = record?.states ?? [];
  if (states.some((state) => state.keyId === distribution.keyId)) return { states };
  const state: PeerSenderKeyState = { keyId: distribution.keyId, chainKey: distribution.chainKey, iteration: distribution.iteration, signingPublicKey: distribution.signingPublicKey, skipped: [] };
  return { states: [state, ...states].slice(0, maximumSenderKeyStates) };
}

export function groupEncrypt(own: OwnSenderKey, conversationId: string, senderUserId: string, senderDeviceId: string, plaintext: Bytes): { own: OwnSenderKey; message: Bytes } {
  const [messageKey, nextChainKey] = chainStep(own.chainKey);
  const { key, nonce } = groupMessageKeys(messageKey);
  const associatedData = groupAssociatedData(conversationId, senderUserId, senderDeviceId);
  const body = concatBytes(new Uint8Array([groupMessageVersion]), writeUint32(own.keyId), writeUint32(own.iteration), sealAead(key, nonce, plaintext, associatedData));
  const signature = sign(own.signing.secretKey, concatBytes(associatedData, body));
  return { own: { ...own, chainKey: nextChainKey, iteration: own.iteration + 1 }, message: concatBytes(body, signature) };
}

export const readGroupMessageKeyId = (message: Bytes): number => new ByteReader(message.slice(1, 5)).uint32();

export function groupDecrypt(record: PeerSenderKeyRecord | null, conversationId: string, senderUserId: string, senderDeviceId: string, message: Bytes): { record: PeerSenderKeyRecord; plaintext: Bytes } {
  if (message.length < 1 + 8 + 16 + signatureLength || message[0] !== groupMessageVersion) throw new ChatCryptoError("INVALID_MESSAGE", "The group message is malformed.");
  const body = message.slice(0, message.length - signatureLength);
  const signature = message.slice(message.length - signatureLength);
  const reader = new ByteReader(body);
  reader.uint8();
  const keyId = reader.uint32();
  const iteration = reader.uint32();
  const ciphertext = reader.rest();
  const state = record?.states.find((candidate) => candidate.keyId === keyId);
  if (record === null || state === undefined) throw new ChatCryptoError("NO_SENDER_KEY", "The sender key for this message is missing.");
  const associatedData = groupAssociatedData(conversationId, senderUserId, senderDeviceId);
  if (!verifySignature(signature, concatBytes(associatedData, body), state.signingPublicKey)) throw new ChatCryptoError("INVALID_SIGNATURE", "The group message signature is invalid.");
  let next: PeerSenderKeyState;
  let messageKey: Bytes;
  if (iteration < state.iteration) {
    const skipped = state.skipped.find((entry) => entry.iteration === iteration);
    if (skipped === undefined) throw new ChatCryptoError("DUPLICATE_MESSAGE", "This message was already received.");
    messageKey = skipped.messageKey;
    next = { ...state, skipped: state.skipped.filter((entry) => entry !== skipped) };
  } else {
    if (iteration - state.iteration > maximumSenderKeySkip) throw new ChatCryptoError("TOO_MANY_SKIPPED", "Too many messages were skipped.");
    const skipped = [...state.skipped];
    let chainKey = state.chainKey;
    for (let current = state.iteration; current < iteration; current++) {
      const [skippedKey, following] = chainStep(chainKey);
      skipped.push({ iteration: current, messageKey: skippedKey });
      chainKey = following;
    }
    const [currentKey, following] = chainStep(chainKey);
    messageKey = currentKey;
    next = { ...state, chainKey: following, iteration: iteration + 1, skipped: skipped.slice(-maximumSenderKeySkip) };
  }
  const { key, nonce } = groupMessageKeys(messageKey);
  let plaintext: Bytes;
  try {
    plaintext = openAead(key, nonce, ciphertext, associatedData);
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The group message could not be authenticated.");
  }
  return { record: { states: record.states.map((candidate) => (candidate.keyId === keyId ? next : candidate)) }, plaintext };
}
