import { type Bytes, ByteReader, bytesEqual, concatBytes, writeUint32 } from "./bytes.util";
import { ChatCryptoError } from "./errors";
import { type KeyPair, type RandomSource, agree, deriveKey, generateAgreementKeyPair, hmacSha256, openAead, sealAead, zeroSalt } from "./primitives";
import type { X3dhInitiation, X3dhResult } from "./x3dh";

export interface ChainState {
  readonly key: Bytes;
  readonly index: number;
}

export interface SkippedMessageKey {
  readonly ratchetKey: Bytes;
  readonly index: number;
  readonly messageKey: Bytes;
}

export interface PendingPreKey {
  readonly signedPreKeyId: number;
  readonly oneTimePreKeyId: number | null;
}

export interface RatchetState {
  readonly rootKey: Bytes;
  readonly sendingRatchet: KeyPair;
  readonly remoteRatchetKey: Bytes | null;
  readonly previousRemoteRatchetKeys: readonly Bytes[];
  readonly sendingChain: ChainState | null;
  readonly receivingChain: ChainState | null;
  readonly previousCounter: number;
  readonly skipped: readonly SkippedMessageKey[];
  readonly associatedData: Bytes;
  readonly remoteIdentityKey: Bytes;
  readonly baseKey: Bytes;
  readonly pendingPreKey: PendingPreKey | null;
}

export interface RatchetHeader {
  readonly ratchetKey: Bytes;
  readonly previousCounter: number;
  readonly index: number;
}

export const maximumSkippedPerChain = 2000;
export const maximumStoredSkippedKeys = 2000;
const rememberedRemoteRatchetKeys = 8;
export const headerLength = 40;

const kdfRoot = (rootKey: Bytes, agreement: Bytes): [Bytes, Bytes] => {
  const output = deriveKey(agreement, rootKey, "ZudomartRatchetv1", 64);
  return [output.slice(0, 32), output.slice(32)];
};

const chainStep = (chainKey: Bytes): [Bytes, Bytes] => [hmacSha256(chainKey, new Uint8Array([1])), hmacSha256(chainKey, new Uint8Array([2]))];

export const encodeHeader = (header: RatchetHeader): Bytes => concatBytes(header.ratchetKey, writeUint32(header.previousCounter), writeUint32(header.index));

export function decodeHeader(bytes: Bytes): RatchetHeader {
  const reader = new ByteReader(bytes);
  return { ratchetKey: reader.take(32), previousCounter: reader.uint32(), index: reader.uint32() };
}

function messageKeyMaterial(messageKey: Bytes): { key: Bytes; nonce: Bytes } {
  const material = deriveKey(messageKey, zeroSalt, "ZudomartMessageKeysv1", 44);
  return { key: material.slice(0, 32), nonce: material.slice(32) };
}

function sealWithMessageKey(messageKey: Bytes, associatedData: Bytes, header: RatchetHeader, plaintext: Bytes): Bytes {
  const { key, nonce } = messageKeyMaterial(messageKey);
  return sealAead(key, nonce, plaintext, concatBytes(associatedData, encodeHeader(header)));
}

function openWithMessageKey(messageKey: Bytes, associatedData: Bytes, header: RatchetHeader, ciphertext: Bytes): Bytes {
  const { key, nonce } = messageKeyMaterial(messageKey);
  try {
    return openAead(key, nonce, ciphertext, concatBytes(associatedData, encodeHeader(header)));
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The message could not be authenticated.");
  }
}

export function initializeInitiator(x3dh: X3dhInitiation, remoteSignedPreKey: Bytes, remoteIdentityKey: Bytes, pendingPreKey: PendingPreKey, random: RandomSource): RatchetState {
  const sendingRatchet = generateAgreementKeyPair(random);
  const [rootKey, sendingChainKey] = kdfRoot(x3dh.sharedSecret, agree(sendingRatchet.secretKey, remoteSignedPreKey));
  return {
    rootKey, sendingRatchet, remoteRatchetKey: remoteSignedPreKey, previousRemoteRatchetKeys: [], sendingChain: { key: sendingChainKey, index: 0 }, receivingChain: null,
    previousCounter: 0, skipped: [], associatedData: x3dh.associatedData, remoteIdentityKey, baseKey: x3dh.baseKey.publicKey, pendingPreKey,
  };
}

export function initializeResponder(x3dh: X3dhResult, signedPreKey: KeyPair, remoteIdentityKey: Bytes, baseKey: Bytes): RatchetState {
  return {
    rootKey: x3dh.sharedSecret, sendingRatchet: signedPreKey, remoteRatchetKey: null, previousRemoteRatchetKeys: [], sendingChain: null, receivingChain: null,
    previousCounter: 0, skipped: [], associatedData: x3dh.associatedData, remoteIdentityKey, baseKey, pendingPreKey: null,
  };
}

export function ratchetEncrypt(state: RatchetState, plaintext: Bytes): { state: RatchetState; header: RatchetHeader; ciphertext: Bytes } {
  if (state.sendingChain === null) throw new ChatCryptoError("NO_SESSION", "This session cannot send yet.");
  const [messageKey, nextChainKey] = chainStep(state.sendingChain.key);
  const header = { ratchetKey: state.sendingRatchet.publicKey, previousCounter: state.previousCounter, index: state.sendingChain.index };
  const ciphertext = sealWithMessageKey(messageKey, state.associatedData, header, plaintext);
  return { state: { ...state, sendingChain: { key: nextChainKey, index: state.sendingChain.index + 1 } }, header, ciphertext };
}

function skipMessageKeys(state: RatchetState, until: number): RatchetState {
  if (state.receivingChain === null || state.remoteRatchetKey === null) return state;
  if (until - state.receivingChain.index > maximumSkippedPerChain) throw new ChatCryptoError("TOO_MANY_SKIPPED", "Too many messages were skipped.");
  let chain = state.receivingChain;
  const skipped = [...state.skipped];
  while (chain.index < until) {
    const [messageKey, nextChainKey] = chainStep(chain.key);
    skipped.push({ ratchetKey: state.remoteRatchetKey, index: chain.index, messageKey });
    chain = { key: nextChainKey, index: chain.index + 1 };
  }
  return { ...state, receivingChain: chain, skipped: skipped.slice(-maximumStoredSkippedKeys) };
}

function stepRatchet(state: RatchetState, remoteRatchetKey: Bytes, random: RandomSource): RatchetState {
  const [receivingRoot, receivingChainKey] = kdfRoot(state.rootKey, agree(state.sendingRatchet.secretKey, remoteRatchetKey));
  const sendingRatchet = generateAgreementKeyPair(random);
  const [rootKey, sendingChainKey] = kdfRoot(receivingRoot, agree(sendingRatchet.secretKey, remoteRatchetKey));
  const previous = state.remoteRatchetKey === null ? state.previousRemoteRatchetKeys : [...state.previousRemoteRatchetKeys, state.remoteRatchetKey];
  return {
    ...state, rootKey, sendingRatchet, remoteRatchetKey, previousRemoteRatchetKeys: previous.slice(-rememberedRemoteRatchetKeys),
    previousCounter: state.sendingChain?.index ?? 0, receivingChain: { key: receivingChainKey, index: 0 }, sendingChain: { key: sendingChainKey, index: 0 },
  };
}

export function ratchetDecrypt(state: RatchetState, header: RatchetHeader, ciphertext: Bytes, random: RandomSource): { state: RatchetState; plaintext: Bytes } {
  const skippedIndex = state.skipped.findIndex((entry) => entry.index === header.index && bytesEqual(entry.ratchetKey, header.ratchetKey));
  if (skippedIndex >= 0) {
    const entry = state.skipped[skippedIndex] as SkippedMessageKey;
    const plaintext = openWithMessageKey(entry.messageKey, state.associatedData, header, ciphertext);
    return { state: { ...state, skipped: state.skipped.filter((_, index) => index !== skippedIndex), pendingPreKey: null }, plaintext };
  }
  if (state.previousRemoteRatchetKeys.some((key) => bytesEqual(key, header.ratchetKey))) throw new ChatCryptoError("DUPLICATE_MESSAGE", "This message was already received.");
  let next = state;
  if (next.remoteRatchetKey === null || !bytesEqual(header.ratchetKey, next.remoteRatchetKey)) {
    next = stepRatchet(skipMessageKeys(next, header.previousCounter), header.ratchetKey, random);
  }
  const receivingChain = next.receivingChain as ChainState;
  if (header.index < receivingChain.index) throw new ChatCryptoError("DUPLICATE_MESSAGE", "This message was already received.");
  next = skipMessageKeys(next, header.index);
  const [messageKey, nextChainKey] = chainStep((next.receivingChain as ChainState).key);
  const plaintext = openWithMessageKey(messageKey, next.associatedData, header, ciphertext);
  return { state: { ...next, receivingChain: { key: nextChainKey, index: header.index + 1 }, pendingPreKey: null }, plaintext };
}
