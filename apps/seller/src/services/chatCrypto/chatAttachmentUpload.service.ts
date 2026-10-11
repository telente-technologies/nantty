import { type AttachmentDetails, type AttachmentPointer, encryptAttachment, encryptedAttachmentMimeType } from "@zudomart/chat-crypto";

import { sendSellerApiRequest } from "@/services/clientApi.service";
import { hashArrayBufferAsHex, retryChunk, sendBytesToUploadTarget, sendMultipartChunks } from "@/services/mediaUpload.service";
import type { MediaUploadSession } from "@/types/productRequests.type";
import { maximumChatAttachmentBytes } from "@/utils/storeChat.util";

export class ChatAttachmentError extends Error {
  public constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ChatAttachmentError";
  }
}

async function readImageDetails(file: Blob): Promise<Pick<AttachmentDetails, "width" | "height" | "thumbnail">> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return { width: null, height: null, thumbnail: null };
  try {
    const bitmap = await createImageBitmap(file);
    const width = 24;
    const height = Math.max(1, Math.round((bitmap.height / Math.max(1, bitmap.width)) * width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    const details = { width: bitmap.width, height: bitmap.height, thumbnail: canvas.toDataURL("image/jpeg", 0.4).split(",")[1] ?? null };
    bitmap.close();
    return details;
  } catch {
    return { width: null, height: null, thumbnail: null };
  }
}

export async function uploadEncryptedChatAttachment(file: File, kind: "image" | "video" | "document", onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<{ readonly mediaId: string; readonly pointer: AttachmentPointer }> {
  if (file.size === 0) throw new ChatAttachmentError(`${file.name} is empty.`, "FILE_EMPTY");
  if (file.size > maximumChatAttachmentBytes) throw new ChatAttachmentError("Files can be up to 100 MB.", "FILE_TOO_LARGE");
  const image = kind === "image" ? await readImageDetails(file) : { width: null, height: null, thumbnail: null };
  const { blob, pointer } = encryptAttachment(new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream", fileName: kind === "document" ? file.name.slice(0, 200) : null, durationSeconds: null, ...image,
  });
  const sealed = blob.slice().buffer as ArrayBuffer;
  const session = await sendSellerApiRequest<MediaUploadSession>("/media/uploads", {
    method: "POST", body: { fileName: "attachment.bin", mimeType: encryptedAttachmentMimeType, sizeBytes: sealed.byteLength, purpose: "chat", sha256: await hashArrayBufferAsHex(sealed) }, signal,
  });
  try {
    if (session.mode === "single" && session.url) {
      await retryChunk(() => sendBytesToUploadTarget(session.url as string, sealed, session.headers ?? { "Content-Type": encryptedAttachmentMimeType }, signal));
    } else {
      await sendMultipartChunks(session, sealed, (fraction) => onProgress(Math.min(0.95, fraction)), signal);
    }
    const completed = await sendSellerApiRequest<{ mediaId: string }>(`/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST", signal });
    onProgress(1);
    return { mediaId: completed.mediaId, pointer };
  } catch (error) {
    void sendSellerApiRequest(`/media/uploads/${encodeURIComponent(session.uploadId)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}
