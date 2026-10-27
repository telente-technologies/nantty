import { bytesEqual, concatBytes, decodeBase64, encodeBase64 } from "./bytes.util";
import { ChatCryptoError } from "./errors";
import { type RandomSource, aeadKeyLength, aeadNonceLength, defaultRandomSource, openAead, sealAead, sha256Digest } from "./primitives";
import { sanitizeVoiceNoteWaveform } from "./voiceNoteWaveform";

export const encryptedAttachmentMimeType = "application/vnd.nantty.encrypted";
export const maximumThumbnailLength = 6_000;

export interface AttachmentPointer {
  readonly key: string;
  readonly digest: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly fileName?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly durationSeconds?: number | null;
  readonly pageCount?: number | null;
  readonly thumbnail?: string | null;
  readonly waveform?: readonly number[] | null;
}

export type AttachmentDetails = Omit<AttachmentPointer, "key" | "digest" | "sizeBytes">;

const attachmentAssociatedData = new TextEncoder().encode("nantty-attachment-v1");

export function encryptAttachment(plaintext: Uint8Array, details: AttachmentDetails, random: RandomSource = defaultRandomSource): { readonly blob: Uint8Array; readonly pointer: AttachmentPointer; readonly sha256Hex: string } {
  const key = random(aeadKeyLength);
  const nonce = random(aeadNonceLength);
  const blob = concatBytes(nonce, sealAead(key, nonce, plaintext, attachmentAssociatedData));
  const digest = sha256Digest(blob);
  const thumbnail = details.thumbnail && details.thumbnail.length <= maximumThumbnailLength ? details.thumbnail : null;
  const { waveform: requestedWaveform, ...otherDetails } = details;
  const waveform = sanitizeVoiceNoteWaveform(requestedWaveform);
  return {
    blob,
    sha256Hex: [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    pointer: { ...otherDetails, ...(waveform ? { waveform } : {}), thumbnail, key: encodeBase64(key), digest: encodeBase64(digest), sizeBytes: plaintext.byteLength },
  };
}

export function decryptAttachment(blob: Uint8Array, pointer: AttachmentPointer): Uint8Array {
  if (!bytesEqual(sha256Digest(blob), decodeBase64(pointer.digest))) throw new ChatCryptoError("INVALID_MESSAGE", "The attachment does not match its digest.");
  let plaintext: Uint8Array;
  try {
    plaintext = openAead(decodeBase64(pointer.key), blob.slice(0, aeadNonceLength), blob.slice(aeadNonceLength), attachmentAssociatedData);
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The attachment could not be authenticated.");
  }
  if (plaintext.byteLength !== pointer.sizeBytes) throw new ChatCryptoError("INVALID_MESSAGE", "The attachment size does not match.");
  return plaintext;
}

const isString = (value: unknown): value is string => typeof value === "string";
const optionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

export function sanitizeAttachmentPointer(value: unknown): AttachmentPointer | null {
  if (value === null || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isString(candidate.key) || candidate.key.length !== 44 || !isString(candidate.digest) || candidate.digest.length !== 44) return null;
  if (typeof candidate.sizeBytes !== "number" || !Number.isInteger(candidate.sizeBytes) || candidate.sizeBytes < 0 || !isString(candidate.contentType)) return null;
  const waveform = sanitizeVoiceNoteWaveform(candidate.waveform);
  return {
    key: candidate.key, digest: candidate.digest, sizeBytes: candidate.sizeBytes, contentType: candidate.contentType.slice(0, 120),
    fileName: isString(candidate.fileName) ? candidate.fileName.slice(0, 300) : null,
    width: optionalNumber(candidate.width), height: optionalNumber(candidate.height), durationSeconds: optionalNumber(candidate.durationSeconds), pageCount: optionalNumber(candidate.pageCount),
    thumbnail: isString(candidate.thumbnail) && candidate.thumbnail.length <= maximumThumbnailLength && /^[A-Za-z0-9+/=]*$/.test(candidate.thumbnail) ? candidate.thumbnail : null,
    ...(waveform ? { waveform } : {}),
  };
}
