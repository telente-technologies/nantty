import { type Bytes, ByteReader, concatBytes, writeUint32 } from "./bytes.util";
import { type RatchetHeader, decodeHeader, encodeHeader, headerLength } from "./doubleRatchet";
import { ChatCryptoError } from "./errors";

export interface RatchetWireMessage {
  readonly type: "message";
  readonly header: RatchetHeader;
  readonly ciphertext: Bytes;
}

export interface PreKeyWireMessage {
  readonly type: "preKey";
  readonly registrationId: number;
  readonly identityKey: Bytes;
  readonly baseKey: Bytes;
  readonly signedPreKeyId: number;
  readonly oneTimePreKeyId: number | null;
  readonly message: RatchetWireMessage;
}

export type PairwiseWireMessage = RatchetWireMessage | PreKeyWireMessage;

const ratchetMessageVersion = 0x31;
const preKeyMessageVersion = 0x32;

const encodeRatchetMessage = (message: RatchetWireMessage): Bytes => concatBytes(new Uint8Array([ratchetMessageVersion]), encodeHeader(message.header), message.ciphertext);

export function encodePairwiseMessage(message: PairwiseWireMessage): Bytes {
  if (message.type === "message") return encodeRatchetMessage(message);
  return concatBytes(
    new Uint8Array([preKeyMessageVersion]), writeUint32(message.registrationId), message.identityKey, message.baseKey,
    writeUint32(message.signedPreKeyId), writeUint32(message.oneTimePreKeyId ?? 0), encodeRatchetMessage(message.message),
  );
}

function decodeRatchetMessage(reader: ByteReader): RatchetWireMessage {
  if (reader.uint8() !== ratchetMessageVersion) throw new ChatCryptoError("INVALID_MESSAGE", "Unknown message version.");
  const header = decodeHeader(reader.take(headerLength));
  const ciphertext = reader.rest();
  if (ciphertext.length < 16) throw new ChatCryptoError("INVALID_MESSAGE", "The message is truncated.");
  return { type: "message", header, ciphertext };
}

export function decodePairwiseMessage(bytes: Bytes): PairwiseWireMessage {
  try {
    if (bytes[0] === ratchetMessageVersion) return decodeRatchetMessage(new ByteReader(bytes));
    if (bytes[0] !== preKeyMessageVersion) throw new ChatCryptoError("INVALID_MESSAGE", "Unknown message version.");
    const reader = new ByteReader(bytes);
    reader.uint8();
    const registrationId = reader.uint32();
    const identityKey = reader.take(32);
    const baseKey = reader.take(32);
    const signedPreKeyId = reader.uint32();
    const oneTimePreKeyId = reader.uint32();
    return { type: "preKey", registrationId, identityKey, baseKey, signedPreKeyId, oneTimePreKeyId: oneTimePreKeyId === 0 ? null : oneTimePreKeyId, message: decodeRatchetMessage(reader) };
  } catch (error) {
    if (error instanceof ChatCryptoError) throw error;
    throw new ChatCryptoError("INVALID_MESSAGE", "The message is malformed.");
  }
}
