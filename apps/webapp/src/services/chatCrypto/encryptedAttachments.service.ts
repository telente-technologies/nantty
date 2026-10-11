import { type AttachmentDetails, type AttachmentPointer, encryptAttachment, encryptedAttachmentMimeType } from "@zudomart/chat-crypto";

import type { ID } from "@/types";

import { mediaUploadService, type UploadProgress } from "../mediaUpload.service";

export type EncryptedAttachmentPurpose = "chat" | "voice";

export const maximumChatAttachmentBytes = 100 * 1024 * 1024;

export async function buildEncryptedThumbnail(file: Blob): Promise<string | null> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const width = 24;
    const height = Math.max(1, Math.round((bitmap.height / Math.max(1, bitmap.width)) * width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.4).split(",")[1] ?? null;
  } catch {
    return null;
  }
}

export async function readImageSize(file: Blob): Promise<{ readonly width: number | null; readonly height: number | null }> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export async function uploadEncryptedAttachment(
  file: Blob,
  details: AttachmentDetails,
  purpose: EncryptedAttachmentPurpose,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ readonly mediaId: ID; readonly pointer: AttachmentPointer }> {
  if (file.size > maximumChatAttachmentBytes) throw new Error("Files can be up to 100 MB.");
  const { blob, pointer } = encryptAttachment(new Uint8Array(await file.arrayBuffer()), details);
  const sealedFile = new File([blob as Uint8Array<ArrayBuffer>], "attachment.bin", { type: encryptedAttachmentMimeType });
  const uploaded = await mediaUploadService.uploadFile(sealedFile, purpose, (progress: UploadProgress) => onProgress?.(progress.totalBytes === 0 ? 0 : Math.min(0.99, progress.uploadedBytes / progress.totalBytes)), signal);
  onProgress?.(1);
  return { mediaId: uploaded.mediaId, pointer };
}
