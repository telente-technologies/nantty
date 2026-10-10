import { type AttachmentDetails, type AttachmentPointer, decryptAttachment, encryptAttachment, encryptedAttachmentMimeType } from "@zudomart/chat-crypto";
import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import { mediaUploadTransport } from "../media/mediaUploadTransport.service";
import { randomBytesFromDevice } from "./mobileKeyStore";

export type EncryptedAttachmentPurpose = "chat" | "voice";

const decryptedUris = new Map<string, Promise<string>>();

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

async function downloadAndDecrypt(mediaId: string, url: string, pointer: AttachmentPointer): Promise<string> {
  if (Platform.OS !== "web") {
    const cached = new File(Paths.cache, `zm-attachment-${mediaId}`);
    if (cached.exists && cached.size === pointer.sizeBytes) return cached.uri;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("ATTACHMENT_UNAVAILABLE");
  const plaintext = decryptAttachment(new Uint8Array(await response.arrayBuffer()), pointer);
  if (Platform.OS === "web") return URL.createObjectURL(new Blob([plaintext as Uint8Array<ArrayBuffer>], { type: pointer.contentType }));
  const file = new File(Paths.cache, `zm-attachment-${mediaId}`);
  if (file.exists) file.delete();
  file.create();
  file.write(plaintext);
  return file.uri;
}

export function resolveDecryptedAttachmentUri(mediaId: string, url: string, pointer: AttachmentPointer): Promise<string> {
  let pending = decryptedUris.get(mediaId);
  if (!pending) {
    pending = downloadAndDecrypt(mediaId, url, pointer);
    decryptedUris.set(mediaId, pending);
    pending.catch(() => decryptedUris.delete(mediaId));
  }
  return pending;
}
