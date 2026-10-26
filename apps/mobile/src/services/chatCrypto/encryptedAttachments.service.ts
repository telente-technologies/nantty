import { type AttachmentDetails, type AttachmentPointer, decryptAttachment, encodeBase64, encryptAttachment, encryptedAttachmentMimeType } from "@nantty/chat-crypto";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import { mediaUploadTransport } from "../media/mediaUploadTransport.service";
import { randomBytesFromDevice } from "./mobileKeyStore";

export type EncryptedAttachmentPurpose = "chat" | "voice";

async function readLocalFileBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

export async function buildEncryptedThumbnail(uri: string): Promise<string | null> {
  try {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 24 }).renderAsync();
    return (await rendered.saveAsync({ compress: 0.4, format: SaveFormat.JPEG, base64: true })).base64 ?? null;
  } catch {
    return null;
  }
}

export async function uploadEncryptedAttachment(localUri: string, details: AttachmentDetails, purpose: EncryptedAttachmentPurpose, onProgress?: (fraction: number) => void, isCancelled?: () => boolean): Promise<{ readonly mediaId: string; readonly pointer: AttachmentPointer }> {
  const { blob, pointer, sha256Hex } = encryptAttachment(await readLocalFileBytes(localUri), details, randomBytesFromDevice);
  const session = await mediaUploadTransport.createUploadSession({ fileName: "attachment.bin", mimeType: encryptedAttachmentMimeType, sizeBytes: blob.byteLength, purpose, sha256: sha256Hex });
  let sentBytes = 0;
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex++) {
    if (isCancelled?.()) {
      await mediaUploadTransport.abortUploadSession(session.uploadId).catch(() => undefined);
      throw new Error("UPLOAD_CANCELLED");
    }
    const chunk = blob.slice(chunkIndex * session.chunkSizeBytes, (chunkIndex + 1) * session.chunkSizeBytes);
    if (!session.uploadedChunks.includes(chunkIndex)) await mediaUploadTransport.uploadChunk(session.uploadId, chunkIndex, chunk, (bytes) => onProgress?.(Math.min(0.99, (sentBytes + bytes) / blob.byteLength)));
    sentBytes += chunk.byteLength;
  }
  const completed = await mediaUploadTransport.completeUploadSession(session.uploadId);
  return { mediaId: completed.mediaId, pointer };
}

const maximumBytesHeldInMemory = 48 * 1024 * 1024;
const decryptedInMemory = new Map<string, Promise<Uint8Array>>();
const sizesInMemory = new Map<string, number>();

const downloadEncryptedBlob = async (target: string) => {
  const response = await fetch(target);
  if (!response.ok) throw new Error("ATTACHMENT_UNAVAILABLE");
  return response.arrayBuffer();
};

function evictUntilWithinBudget() {
  let total = [...sizesInMemory.values()].reduce((sum, size) => sum + size, 0);
  for (const key of [...sizesInMemory.keys()]) {
    if (total <= maximumBytesHeldInMemory) return;
    total -= sizesInMemory.get(key) ?? 0;
    sizesInMemory.delete(key);
    decryptedInMemory.delete(key);
  }
}

export function decryptAttachmentInMemory(mediaId: string, url: string, pointer: AttachmentPointer, download: (url: string) => Promise<ArrayBuffer> = downloadEncryptedBlob): Promise<Uint8Array> {
  const key = `${mediaId}:${pointer.digest}`;
  let pending = decryptedInMemory.get(key);
  if (pending) {
    decryptedInMemory.delete(key);
    decryptedInMemory.set(key, pending);
    return pending;
  }
  pending = download(url).then((bytes) => decryptAttachment(new Uint8Array(bytes), pointer));
  decryptedInMemory.set(key, pending);
  pending.then((plaintext) => {
    if (decryptedInMemory.get(key) !== pending) return;
    sizesInMemory.set(key, plaintext.byteLength);
    evictUntilWithinBudget();
  }, () => decryptedInMemory.delete(key));
  return pending;
}

export const toDataUri = (contentType: string, bytes: Uint8Array) => `data:${contentType};base64,${encodeBase64(bytes)}`;

export const resolveDecryptedImageInMemory = async (mediaId: string, url: string, pointer: AttachmentPointer, download?: (url: string) => Promise<ArrayBuffer>): Promise<string> =>
  toDataUri(pointer.contentType, await decryptAttachmentInMemory(mediaId, url, pointer, download));

export function forgetDecryptedAttachmentsInMemory() {
  decryptedInMemory.clear();
  sizesInMemory.clear();
}
